"""
Tests for judge0_service.py — mocks HTTP calls to avoid real network requests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys

# Mock supabase before app imports
sys.modules.setdefault("supabase", MagicMock())

from app.services.judge0_service import (
    execute_code,
    run_test_cases,
    get_language_id,
    ExecutionResult,
)

# ── Language ID mapping tests ────────────────────────────────────────────────

def test_get_language_id_python():
    assert get_language_id("python") == 71

def test_get_language_id_javascript():
    assert get_language_id("javascript") == 93

def test_get_language_id_unknown_defaults_to_python():
    assert get_language_id("brainfuck") == 71

# ── ExecutionResult parsing ──────────────────────────────────────────────────

def test_execution_result_accepted():
    data = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "Hello\n",
        "stderr": "",
        "compile_output": "",
        "time": "0.05",
        "memory": 1024,
    }
    result = ExecutionResult(data)
    assert result.accepted is True
    assert result.stdout == "Hello\n"
    assert result.error_output == ""

def test_execution_result_runtime_error():
    data = {
        "status": {"id": 11, "description": "Runtime Error (SIGSEGV)"},
        "stdout": "",
        "stderr": "NameError: name 'x' is not defined",
        "compile_output": "",
        "time": "0",
        "memory": None,
    }
    result = ExecutionResult(data)
    assert result.accepted is False
    assert result.runtime_error is True
    assert "NameError" in result.error_output

def test_execution_result_compile_error():
    data = {
        "status": {"id": 6, "description": "Compilation Error"},
        "stdout": "",
        "stderr": "",
        "compile_output": "SyntaxError: invalid syntax",
        "time": "0",
        "memory": None,
    }
    result = ExecutionResult(data)
    assert result.accepted is False
    assert result.compile_error is True
    assert "SyntaxError" in result.error_output

# ── execute_code (mocked HTTP) ───────────────────────────────────────────────

@pytest.mark.anyio
async def test_execute_code_success():
    """Test that execute_code returns an accepted result when Judge0 responds correctly."""
    submission_response = MagicMock()
    submission_response.json.return_value = {"token": "test-token-123"}
    submission_response.raise_for_status = MagicMock()

    result_response = MagicMock()
    result_response.json.return_value = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "42\n",
        "stderr": "",
        "compile_output": "",
        "time": "0.05",
        "memory": 2048,
    }
    result_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=submission_response)
    mock_client.get = AsyncMock(return_value=result_response)

    with patch("app.services.judge0_service.httpx.AsyncClient", return_value=mock_client):
        result = await execute_code("print(42)", "python")

    assert result.accepted is True
    assert "42" in result.stdout

# ── run_test_cases (mocked execute_code) ────────────────────────────────────

@pytest.mark.anyio
async def test_run_test_cases_all_pass():
    """Test that run_test_cases correctly identifies when all tests pass."""
    mock_result = MagicMock()
    mock_result.accepted = True
    mock_result.stdout = "hello"
    mock_result.error_output = ""
    mock_result.time = "0.05"
    mock_result.status_desc = "Accepted"

    test_cases = [
        {"input": "", "expected_output": "hello", "description": "Basic test"},
    ]

    with patch("app.services.judge0_service.execute_code", AsyncMock(return_value=mock_result)):
        results = await run_test_cases("print('hello')", "python", test_cases)

    assert len(results) == 1
    assert results[0]["passed"] is True
    assert results[0]["actual_output"] == "hello"

@pytest.mark.anyio
async def test_run_test_cases_fail():
    """Test that run_test_cases detects wrong output."""
    mock_result = MagicMock()
    mock_result.accepted = True
    mock_result.stdout = "wrong output"
    mock_result.error_output = ""
    mock_result.time = "0.04"
    mock_result.status_desc = "Accepted"

    test_cases = [
        {"input": "", "expected_output": "correct output", "description": "Failing test"},
    ]

    with patch("app.services.judge0_service.execute_code", AsyncMock(return_value=mock_result)):
        results = await run_test_cases("code", "python", test_cases)

    assert results[0]["passed"] is False
