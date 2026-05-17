"""
Tests for llm_router.py — verifies key rotation and litellm fallback behavior.
"""
import sys
import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch

# Mock supabase before app imports
sys.modules.setdefault("supabase", MagicMock())

from app.core.llm_router import LLMRouter, AllProvidersFailedError, _KeyState


# ── _KeyState tests ──────────────────────────────────────────────────────────

def test_key_state_initially_available():
    ks = _KeyState("test-key-abc123")
    assert ks.is_available() is True

def test_key_state_cooldown_on_failure():
    ks = _KeyState("test-key-abc123")
    ks.mark_failure(is_rate_limit=True)
    # Should be unavailable right after a rate-limit failure
    assert ks.is_available() is False

def test_key_state_recovers_after_success():
    ks = _KeyState("test-key-abc123")
    ks.mark_failure(is_rate_limit=False)
    ks.mark_success()
    assert ks.is_available() is True
    assert ks.failures == 0

# ── LLMRouter generate tests ─────────────────────────────────────────────────

@pytest.fixture
def anyio_backend():
    return "asyncio"

def _make_router_with_mock_keys():
    """
    Creates an LLMRouter with fake _KeyState objects.
    """
    router = LLMRouter()
    router._initialized = True
    router._keys = [
        _KeyState("fake-key-0"),
        _KeyState("fake-key-1")
    ]
    return router

@pytest.mark.anyio
@patch("app.core.llm_router.litellm.acompletion")
async def test_router_uses_first_key_on_success(mock_acompletion):
    """First key succeeds immediately."""
    router = _make_router_with_mock_keys()
    
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content='{"result": "ok"}'))]
    mock_acompletion.return_value = mock_response

    result = await router.generate("prompt", "sys")
    assert result == '{"result": "ok"}'
    
    # Should be called once
    mock_acompletion.assert_called_once()
    # Check it used the first key
    assert mock_acompletion.call_args[1]["api_key"] == "fake-key-0"

@pytest.mark.anyio
@patch("app.core.llm_router.litellm.acompletion")
async def test_router_falls_back_to_second_key_on_rate_limit(mock_acompletion):
    """First key raises 429, second key succeeds."""
    router = _make_router_with_mock_keys()
    
    rate_limit_error = Exception("429 RESOURCE_EXHAUSTED")
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="fallback success"))]
    
    mock_acompletion.side_effect = [rate_limit_error, mock_response]

    result = await router.generate("prompt", "sys")
    assert result == "fallback success"
    
    assert mock_acompletion.call_count == 2
    # First key should be marked as cooling down
    assert not router._keys[0].is_available()
    # Second key should still be available
    assert router._keys[1].is_available()

@pytest.mark.anyio
@patch("app.core.llm_router.litellm.acompletion")
async def test_router_raises_when_all_keys_fail(mock_acompletion):
    """All keys fail, and fallback providers also fail — should raise AllProvidersFailedError."""
    router = _make_router_with_mock_keys()
    
    error = Exception("503 Service Unavailable")
    # 2 gemini keys + 2 fallback models = 4 attempts total
    mock_acompletion.side_effect = [error, error, error, error]
    
    with pytest.raises(AllProvidersFailedError):
        await router.generate("prompt", "sys")
        
    assert mock_acompletion.call_count == 4
