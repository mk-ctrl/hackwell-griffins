"""
MindArmor XAI — FastAPI application with WebSocket streaming.

Run:
    uvicorn main:app --reload

Connect:
    ws://localhost:8000/ws
"""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager

import nltk
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agent import analyze_text
from models import (
    AnalysisResult,
    ErrorMessage,
    InfoMessage,
    ResultMessage,
    ThoughtMessage,
)

logger = logging.getLogger("mindarmor")

# ── NLTK bootstrap ───────────────────────────────────────────────────────────

def _bootstrap_nltk() -> None:
    """Download required NLTK data (idempotent)."""
    for resource in ("punkt", "punkt_tab", "averaged_perceptron_tagger", "averaged_perceptron_tagger_eng"):
        try:
            nltk.data.find(f"tokenizers/{resource}" if "punkt" in resource else f"taggers/{resource}")
        except LookupError:
            nltk.download(resource, quiet=True)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_nltk()
    logger.info("MindArmor XAI backend started")
    yield
    logger.info("MindArmor XAI backend shutting down")


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MindArmor XAI Backend",
    description="Detects psychological manipulation in text and streams explainable reasoning.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting (in-memory, per-connection) ────────────────────────────────

MAX_REQUESTS_PER_MINUTE = 10
_rate_limits: dict[int, list[float]] = defaultdict(list)


def _is_rate_limited(conn_id: int) -> bool:
    """Simple sliding-window rate limiter."""
    now = time.time()
    window = [t for t in _rate_limits[conn_id] if now - t < 60]
    _rate_limits[conn_id] = window
    if len(window) >= MAX_REQUESTS_PER_MINUTE:
        return True
    window.append(now)
    return False


# ── Text chunking ────────────────────────────────────────────────────────────

MAX_CHUNK_CHARS = 500


def _chunk_text(text: str) -> list[str]:
    """Split long text into ≤MAX_CHUNK_CHARS segments at sentence boundaries."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]

    import re
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 > MAX_CHUNK_CHARS and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}" if current else sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks if chunks else [text[:MAX_CHUNK_CHARS]]


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "MindArmor XAI Backend",
        "version": "0.1.0",
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    conn_id = id(ws)
    logger.info(f"WebSocket connected: {conn_id}")

    try:
        while True:
            raw = await ws.receive_text()

            # ── Parse input ──────────────────────────────────────────────
            try:
                data = json.loads(raw)
                text: str = data.get("text", "").strip()
            except (json.JSONDecodeError, AttributeError):
                await ws.send_text(
                    ErrorMessage(content="Invalid JSON. Send {\"text\": \"...\"}").model_dump_json()
                )
                continue

            # ── Empty text ───────────────────────────────────────────────
            if not text:
                await ws.send_text(
                    InfoMessage(content="No content to analyze.").model_dump_json()
                )
                continue

            # ── Rate limit ───────────────────────────────────────────────
            if _is_rate_limited(conn_id):
                await ws.send_text(
                    ErrorMessage(content="Rate limit exceeded. Max 10 requests/min.").model_dump_json()
                )
                continue

            # ── Chunk long text ──────────────────────────────────────────
            chunks = _chunk_text(text)

            for idx, chunk in enumerate(chunks):
                if len(chunks) > 1:
                    await ws.send_text(
                        ThoughtMessage(
                            content=f"Processing chunk {idx + 1}/{len(chunks)} ({len(chunk)} chars)..."
                        ).model_dump_json()
                    )

                # ── Stream analysis ──────────────────────────────────────
                try:
                    async for item in analyze_text(chunk):
                        if isinstance(item, AnalysisResult):
                            await ws.send_text(
                                ResultMessage(data=item).model_dump_json()
                            )
                        elif isinstance(item, str):
                            await ws.send_text(
                                ThoughtMessage(content=item).model_dump_json()
                            )
                except Exception as exc:
                    logger.exception("Analysis error")
                    await ws.send_text(
                        ErrorMessage(
                            content=f"Analysis failed: {exc}. Try again."
                        ).model_dump_json()
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {conn_id}")
    except Exception as exc:
        logger.exception(f"WebSocket error: {exc}")
    finally:
        _rate_limits.pop(conn_id, None)
