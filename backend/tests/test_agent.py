"""
Unit tests for the MindArmor analysis agent.
"""

from __future__ import annotations

import asyncio
import sys
import os

import pytest

# Ensure backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agent import analyze_text, _neutralize_text, _flesch_reading_ease  # noqa: E402
from models import AnalysisResult  # noqa: E402


# ── Helper to collect generator output ───────────────────────────────────────

async def _run_analysis(text: str) -> tuple[list[str], AnalysisResult | None]:
    """Collect all thoughts and the final result from the agent."""
    thoughts: list[str] = []
    result: AnalysisResult | None = None
    async for item in analyze_text(text):
        if isinstance(item, AnalysisResult):
            result = item
        elif isinstance(item, str):
            thoughts.append(item)
    return thoughts, result


# ── Tests ────────────────────────────────────────────────────────────────────


class TestHighRiskText:
    """Manipulative text should produce a high risk score."""

    @pytest.mark.asyncio
    async def test_fear_appeal(self):
        text = (
            "This DEVASTATING crisis will DESTROY everything we know! "
            "The collapse is imminent — act NOW before the catastrophe strikes!"
        )
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score > 0.4
        assert len(thoughts) > 0
        assert "fear" in result.type.lower() or "urgency" in result.type.lower()

    @pytest.mark.asyncio
    async def test_outrage_language(self):
        text = (
            "This DISGUSTING betrayal is absolutely outrageous! "
            "The shameful scandal proves they are completely corrupt."
        )
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score > 0.4
        assert "outrage" in result.type.lower() or "anger" in result.type.lower()

    @pytest.mark.asyncio
    async def test_bandwagon(self):
        text = (
            "Everyone knows this is true. The majority agrees, "
            "and nobody disagrees with the popular opinion. It's obvious."
        )
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score > 0.2
        assert "bandwagon" in result.type.lower() or "absolute" in result.type.lower()


class TestLowRiskText:
    """Neutral text should produce a low risk score."""

    @pytest.mark.asyncio
    async def test_neutral_factual(self):
        text = (
            "The quarterly report shows a 3% increase in revenue "
            "compared to the previous period. Analysts note moderate growth."
        )
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score < 0.3
        assert len(thoughts) > 0

    @pytest.mark.asyncio
    async def test_simple_statement(self):
        text = "The weather today is sunny with a high of 75 degrees."
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score < 0.25


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    @pytest.mark.asyncio
    async def test_very_short_text(self):
        text = "Hello."
        thoughts, result = await _run_analysis(text)
        assert result is not None
        assert result.risk_score < 0.3

    @pytest.mark.asyncio
    async def test_thoughts_stream_before_result(self):
        text = "Some text to analyze for potential issues."
        thoughts, result = await _run_analysis(text)
        assert len(thoughts) >= 8  # At least 8 step headers
        assert result is not None

    @pytest.mark.asyncio
    async def test_result_schema(self):
        text = "This urgent crisis demands immediate action!"
        _, result = await _run_analysis(text)
        assert result is not None
        assert 0.0 <= result.risk_score <= 1.0
        assert isinstance(result.type, str) and len(result.type) > 0
        assert isinstance(result.explanation, str)
        assert isinstance(result.neutralized, str)


class TestNeutralization:
    """Test the text neutralization function."""

    def test_replaces_loaded_words(self):
        text = "This devastating crisis will destroy everything!"
        neutral = _neutralize_text(text)
        assert "devastating" not in neutral.lower()
        assert "crisis" not in neutral.lower()
        assert "destroy" not in neutral.lower()

    def test_removes_shouting(self):
        text = "This is ABSOLUTELY TERRIBLE and DISGUSTING"
        neutral = _neutralize_text(text)
        # ALL-CAPS words should be title-cased
        assert "ABSOLUTELY" not in neutral
        assert "TERRIBLE" not in neutral

    def test_collapses_exclamation_marks(self):
        text = "This is terrible!!! Really bad!!!"
        neutral = _neutralize_text(text)
        assert "!!!" not in neutral


class TestReadingEase:
    """Test the Flesch reading ease calculation."""

    def test_simple_text(self):
        score = _flesch_reading_ease("The cat sat on the mat.", 6, 1)
        assert score > 50  # Simple sentence should be easy

    def test_zero_words(self):
        score = _flesch_reading_ease("", 0, 0)
        assert score == 100.0  # Default for empty

    def test_complex_text(self):
        text = (
            "The epistemological ramifications of anthropological "
            "determinations necessitate comprehensive deliberation."
        )
        score = _flesch_reading_ease(text, 7, 1)
        assert score < 50  # Complex words = harder
