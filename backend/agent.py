"""
MindArmor XAI — Core analysis agent.

Async generator that yields step-by-step "thought" strings (for XAI
transparency) followed by a final ``AnalysisResult``.

Pipeline
--------
1. Preprocessing          — tokenize, basic stats
2. Sentiment analysis     — TextBlob polarity / subjectivity
3. Keyword density        — scan manipulation keywords per category
4. Reading ease           — Flesch-Kincaid-like proxy
5. Pattern matching       — match against propaganda/fallacy DB
6. System 1 trigger       — Dual Process Theory synthesis
7. Risk scoring           — weighted composite
8. Neutralization         — rule-based rewrite
"""

from __future__ import annotations

import asyncio
import re
from typing import AsyncGenerator

from textblob import TextBlob

from models import AnalysisResult
from patterns import NEUTRALIZATION_MAP, PATTERNS

# ── Helpers ──────────────────────────────────────────────────────────────────


def _syllable_count(word: str) -> int:
    """Rough syllable count heuristic."""
    word = word.lower().strip()
    if not word:
        return 0
    count = 0
    vowels = "aeiouy"
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def _flesch_reading_ease(text: str, word_count: int, sentence_count: int) -> float:
    """Compute Flesch Reading Ease Score (0-100; lower = harder)."""
    if word_count == 0 or sentence_count == 0:
        return 100.0
    words = text.split()
    total_syllables = sum(_syllable_count(w) for w in words)
    score = (
        206.835
        - 1.015 * (word_count / sentence_count)
        - 84.6 * (total_syllables / word_count)
    )
    return max(0.0, min(100.0, score))


def _neutralize_text(text: str) -> str:
    """Replace loaded words with neutral alternatives."""
    result = text
    for loaded, neutral in NEUTRALIZATION_MAP.items():
        # Case-insensitive replacement, preserving rough casing
        pattern = re.compile(re.escape(loaded), re.IGNORECASE)
        result = pattern.sub(neutral, result)

    # Strip ALL-CAPS shouting  (3+ consecutive uppercase letters → title case)
    result = re.sub(
        r"\b([A-Z]{3,})\b",
        lambda m: m.group(0).capitalize(),
        result,
    )
    # Collapse excessive exclamation / question marks
    result = re.sub(r"[!]{2,}", ".", result)
    result = re.sub(r"[?]{2,}", "?", result)
    return result.strip()


# ── Main analysis generator ─────────────────────────────────────────────────


async def analyze_text(text: str) -> AsyncGenerator[str | AnalysisResult, None]:
    """
    Async generator that performs multi-step analysis.

    Yields
    ------
    str
        Intermediate "thought" messages (XAI transparency).
    AnalysisResult
        The final structured result (last yield).
    """

    total_steps = 8

    # ── Step 1: Preprocessing ────────────────────────────────────────────
    yield f"[Step 1/{total_steps}] Preprocessing text ({len(text)} chars)..."
    await asyncio.sleep(0.15)  # small pause for streaming effect

    words = text.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = max(len(sentences), 1)

    yield (
        f"  → {word_count} words, {sentence_count} sentence(s), "
        f"avg {word_count / sentence_count:.1f} words/sentence"
    )

    # ── Step 2: Sentiment analysis ───────────────────────────────────────
    yield f"[Step 2/{total_steps}] Analyzing sentiment with TextBlob..."
    await asyncio.sleep(0.15)

    blob = TextBlob(text)
    polarity = blob.sentiment.polarity        # -1 … +1
    subjectivity = blob.sentiment.subjectivity  # 0 … 1

    sentiment_label = (
        "very negative" if polarity < -0.5 else
        "negative" if polarity < -0.1 else
        "neutral" if polarity < 0.1 else
        "positive" if polarity < 0.5 else
        "very positive"
    )
    yield (
        f"  → Polarity={polarity:+.2f} ({sentiment_label}), "
        f"Subjectivity={subjectivity:.2f}"
    )

    # ── Step 3: Keyword density ──────────────────────────────────────────
    yield f"[Step 3/{total_steps}] Scanning for manipulation keywords..."
    await asyncio.sleep(0.15)

    text_lower = text.lower()
    matched_categories: dict[str, list[str]] = {}
    category_scores: dict[str, float] = {}

    for category, info in PATTERNS.items():
        hits: list[str] = []
        for kw in info["keywords"]:
            if kw.lower() in text_lower:
                hits.append(kw)
        if hits:
            matched_categories[category] = hits
            # Score: (hit_count / total_keywords) * weight, capped at weight
            density = len(hits) / max(len(info["keywords"]), 1)
            category_scores[category] = min(density * info["weight"] * 2, info["weight"])

    if matched_categories:
        for cat, hits in matched_categories.items():
            yield f"  → [{cat}] matched: {', '.join(hits[:5])}"
    else:
        yield "  → No manipulation keywords detected"

    # ── Step 4: Reading ease ─────────────────────────────────────────────
    yield f"[Step 4/{total_steps}] Computing reading ease (Flesch-Kincaid proxy)..."
    await asyncio.sleep(0.12)

    reading_ease = _flesch_reading_ease(text, word_count, sentence_count)
    ease_label = (
        "very easy" if reading_ease > 80 else
        "easy" if reading_ease > 60 else
        "moderate" if reading_ease > 40 else
        "difficult" if reading_ease > 20 else
        "very difficult"
    )
    yield f"  → Flesch Reading Ease = {reading_ease:.1f} ({ease_label})"

    # ── Step 5: Pattern matching (fallacies) ─────────────────────────────
    yield f"[Step 5/{total_steps}] Matching against propaganda/fallacy database..."
    await asyncio.sleep(0.15)

    if matched_categories:
        primary_category = max(category_scores, key=category_scores.get)  # type: ignore[arg-type]
        yield f"  → Primary pattern: {primary_category} (score {category_scores[primary_category]:.2f})"
        if len(matched_categories) > 1:
            others = [c for c in matched_categories if c != primary_category]
            yield f"  → Also detected: {', '.join(others)}"
    else:
        primary_category = "none"
        yield "  → No propaganda patterns matched"

    # ── Step 6: System 1 trigger assessment ──────────────────────────────
    yield f"[Step 6/{total_steps}] Assessing System 1 (fast/emotional) triggers..."
    await asyncio.sleep(0.12)

    system1_categories = [
        cat for cat, info in PATTERNS.items()
        if cat in matched_categories and info.get("system") == 1
    ]
    system1_intensity = sum(category_scores.get(c, 0) for c in system1_categories)

    if system1_categories:
        yield (
            f"  → System 1 triggers active: {', '.join(system1_categories)} "
            f"(combined intensity {system1_intensity:.2f})"
        )
    else:
        yield "  → No System 1 emotional bypasses detected"

    # ── Step 7: Risk scoring ─────────────────────────────────────────────
    yield f"[Step 7/{total_steps}] Computing composite risk score..."
    await asyncio.sleep(0.12)

    # Components (each 0-1):
    sentiment_risk = (abs(polarity) * 0.7 + subjectivity * 0.3)
    pattern_risk = min(sum(category_scores.values()), 1.0) if category_scores else 0.0
    ease_risk = max(0, (50 - reading_ease) / 50) if reading_ease < 50 else 0.0
    system1_risk = min(system1_intensity, 1.0)

    # Weighted composite
    risk_score = (
        sentiment_risk * 0.20
        + pattern_risk  * 0.40
        + ease_risk     * 0.10
        + system1_risk  * 0.30
    )
    risk_score = round(min(max(risk_score, 0.0), 1.0), 3)

    yield (
        f"  → Sentiment component: {sentiment_risk:.2f}, "
        f"Pattern component: {pattern_risk:.2f}, "
        f"Ease component: {ease_risk:.2f}, "
        f"System 1 component: {system1_risk:.2f}"
    )
    yield f"  → Final risk score: {risk_score}"

    # ── Step 8: Neutralization ───────────────────────────────────────────
    yield f"[Step 8/{total_steps}] Generating neutralized rewrite..."
    await asyncio.sleep(0.15)

    neutralized = _neutralize_text(text)
    yield f"  → Neutralized version generated ({len(neutralized)} chars)"

    # ── Build explanation ────────────────────────────────────────────────
    explanation_parts: list[str] = []

    if matched_categories:
        explanation_parts.append(
            f"Detected manipulation patterns: {', '.join(matched_categories.keys())}."
        )
    if system1_categories:
        explanation_parts.append(
            f"System 1 (fast/emotional) triggers found: {', '.join(system1_categories)}. "
            "These bypass logical processing."
        )
    if abs(polarity) > 0.3:
        explanation_parts.append(
            f"Sentiment is {sentiment_label} (polarity {polarity:+.2f}), "
            f"with {subjectivity:.0%} subjectivity."
        )
    if reading_ease < 50:
        explanation_parts.append(
            f"Reading ease is {ease_label} ({reading_ease:.0f}/100), "
            "adding cognitive friction that pairs with emotional triggers."
        )

    if not explanation_parts:
        explanation_parts.append("No significant manipulation indicators found.")

    explanation = " ".join(explanation_parts)

    # ── Yield final result ───────────────────────────────────────────────
    yield AnalysisResult(
        risk_score=risk_score,
        type=primary_category,
        explanation=explanation,
        neutralized=neutralized,
    )
