"""
MindArmor XAI — Pydantic models for input / output / streaming.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Input ────────────────────────────────────────────────────────────────────

class TextInput(BaseModel):
    """Payload sent by the browser extension over WebSocket."""
    text: str = Field(..., min_length=1, description="Raw text scraped from the page")


# ── Analysis result ──────────────────────────────────────────────────────────

class AnalysisResult(BaseModel):
    """Final structured output returned after analysis."""
    risk_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Overall manipulation risk  (0 = safe, 1 = highly manipulative)",
    )
    type: str = Field(
        ...,
        description="Primary manipulation category (e.g. 'fear appeal', 'bandwagon')",
    )
    explanation: str = Field(
        ...,
        description="Human-readable XAI explanation of why the text is flagged",
    )
    neutralized: str = Field(
        ...,
        description="Rewritten version with loaded language removed",
    )


# ── Stream messages ──────────────────────────────────────────────────────────

class StreamType(str, Enum):
    thought = "thought"
    result = "result"
    error = "error"
    info = "info"


class ThoughtMessage(BaseModel):
    """Intermediate reasoning step streamed to the client."""
    type: StreamType = StreamType.thought
    content: str


class ResultMessage(BaseModel):
    """Final result envelope streamed to the client."""
    type: StreamType = StreamType.result
    data: AnalysisResult


class ErrorMessage(BaseModel):
    """Error envelope."""
    type: StreamType = StreamType.error
    content: str


class InfoMessage(BaseModel):
    """Informational envelope (e.g. 'No content')."""
    type: StreamType = StreamType.info
    content: str
