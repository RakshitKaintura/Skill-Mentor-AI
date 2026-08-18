import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app

@pytest.mark.anyio
@patch("app.services.sandbox_service.httpx.AsyncClient.post")
async def test_sandbox_execute_success(mock_post):
    """Test successful code execution via sandbox endpoint."""
    
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "run": {
            "stdout": "hello world\n",
            "stderr": "",
            "code": 0
        }
    }
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    from app.api.routes.sandbox import execute_code, ExecuteRequest
    from app.services.sandbox_service import SandboxService

    req = ExecuteRequest(
        language="python",
        code="print('hello world')",
        stdin=""
    )

    response = await execute_code(req, auth_user_id="test_user", service=SandboxService())
        
    assert response.stdout == "hello world\n"
    assert response.exit_code == 0
    
    # Check if the right piston payload was sent
    mock_post.assert_called_once()
    payload = mock_post.call_args[1]["json"]
    assert payload["language"] == "python"
    assert payload["files"][0]["content"] == "print('hello world')"
