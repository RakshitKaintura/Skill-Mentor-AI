"""
Tests for memory_service.py — verifies token counting, history formatting,
context windowing, and LLM-powered compression.
"""
import sys
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

# Mock external modules before any app imports
sys.modules.setdefault("supabase", MagicMock())
sys.modules.setdefault("docling", MagicMock())
sys.modules.setdefault("docling.document_converter", MagicMock())

from app.services.memory_service import (
    _count_tokens,
    _format_history,
    TOKEN_HARD_LIMIT,
)

# ── Unit: token counter ────────────────────────────────────────────────────────

def test_count_tokens_returns_int():
    count = _count_tokens("Hello World")
    assert isinstance(count, int)
    assert count > 0

def test_count_tokens_empty_string():
    assert _count_tokens("") == 0

def test_count_tokens_scales_with_length():
    short = _count_tokens("Hi")
    long = _count_tokens("Hi " * 100)
    assert long > short

# ── Unit: history formatter ────────────────────────────────────────────────────

def test_format_history_empty():
    result = _format_history([])
    assert result == ""

def test_format_history_user_assistant_turns():
    turns = [
        {"role": "user", "content": "What is a closure?"},
        {"role": "assistant", "content": "A closure is a function that captures its scope."},
    ]
    result = _format_history(turns)
    assert "Student:" in result
    assert "Mentor:" in result
    assert "closure" in result
    assert "[CONVERSATION HISTORY]" in result
    assert "[END HISTORY]" in result

def test_format_history_with_summary_block():
    turns = [
        {"role": "system_summary", "content": "• Student struggled with closures."},
        {"role": "user", "content": "Now explain generators."},
    ]
    result = _format_history(turns)
    assert "[Context Summary]" in result
    assert "generators" in result

def test_format_history_skips_empty_content():
    turns = [
        {"role": "user", "content": ""},
        {"role": "assistant", "content": "   "},
        {"role": "user", "content": "Real question"},
    ]
    result = _format_history(turns)
    assert "Student: Real question" in result
    # Empty turns should not produce extra labels
    assert result.count("Student:") == 1

# ── Integration: build_context_window ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.services.memory_service.get_supabase")
async def test_build_context_window_no_history(mock_get_supabase):
    """If there's no history, build_context_window returns empty string."""
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value \
        .order.return_value.limit.return_value.execute.return_value.data = []
    mock_get_supabase.return_value = mock_client

    from app.services.memory_service import build_context_window
    result = await build_context_window("user-1", "session-1", "What is a loop?")
    assert result == ""

@pytest.mark.asyncio
@patch("app.services.memory_service.get_supabase")
async def test_build_context_window_small_history(mock_get_supabase):
    """Small history under token limit should be returned verbatim (no compression)."""
    fake_turns = [
        {"role": "user", "content": "What is a list?", "token_count": 10, "created_at": "2026-01-01T00:00:00Z"},
        {"role": "assistant", "content": "A list stores items in order.", "token_count": 15, "created_at": "2026-01-01T00:01:00Z"},
    ]
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value \
        .order.return_value.limit.return_value.execute.return_value.data = fake_turns
    mock_get_supabase.return_value = mock_client

    from app.services.memory_service import build_context_window
    result = await build_context_window("user-1", "session-1", "What is a dict?")
    assert "list" in result.lower()
    assert "[CONVERSATION HISTORY]" in result

@pytest.mark.asyncio
@patch("app.services.memory_service.get_supabase")
async def test_build_context_window_triggers_compression(mock_get_supabase):
    """If total tokens exceed TOKEN_HARD_LIMIT, LLM summarization is triggered."""
    from unittest.mock import patch as _patch
    from app.core.llm_router import llm_router

    # Each turn has enough tokens to push us over the limit
    tokens_per_turn = TOKEN_HARD_LIMIT // 4 + 50
    large_content = "word " * (tokens_per_turn * 4)  # rough 4-chars-per-token

    fake_turns = [
        {"role": "user", "content": large_content, "token_count": tokens_per_turn, "created_at": f"2026-01-01T00:0{i}:00Z"}
        for i in range(6)
    ]
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value \
        .order.return_value.limit.return_value.execute.return_value.data = fake_turns
    mock_get_supabase.return_value = mock_client

    mock_summary = "• Student reviewed basic concepts.\n• Discussed list operations."

    with _patch.object(llm_router, "generate", new=AsyncMock(return_value=mock_summary)) as mock_generate:
        from app.services.memory_service import build_context_window
        result = await build_context_window("user-1", "session-1", "What is a tuple?")

        # LLM should have been called to summarize old turns
        mock_generate.assert_called_once()

    # Result should contain the summary from the LLM mock
    assert "Student reviewed" in result or "[Context Summary]" in result

