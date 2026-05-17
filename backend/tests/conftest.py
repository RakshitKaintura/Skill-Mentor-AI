import os
import sys
from unittest.mock import AsyncMock, MagicMock

# Mock modules before any app imports happen
sys.modules["supabase"] = MagicMock()
sys.modules["docling"] = MagicMock()
sys.modules["docling.document_converter"] = MagicMock()

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.core.config import get_settings
from app.core.gemini import get_ai_client

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    """Ensure tests run with predictable, fake environment variables."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:8000")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-supabase-key")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/1")

@pytest.fixture
def mock_supabase(mocker):
    """Mock the Supabase client to avoid real DB interactions."""
    mock_client = MagicMock()
    # Ensure insert().execute().data[0]["id"] works
    mock_insert_result = MagicMock()
    mock_insert_result.data = [{"id": "test-roadmap-id"}]
    
    mock_execute = MagicMock()
    mock_execute.execute.return_value = mock_insert_result
    
    mock_insert = MagicMock()
    mock_insert.insert.return_value = mock_execute
    
    mock_upsert = MagicMock()
    mock_upsert.upsert.return_value = mock_execute

    def table_mock(table_name):
        if table_name == "roadmaps":
            return mock_insert
        return mock_upsert

    sys.modules["supabase"].create_client.return_value = mock_client
    mock_client.table.side_effect = table_mock
    mocker.patch("app.core.database.get_supabase", return_value=mock_client)
    return mock_client

@pytest.fixture
def mock_gemini(mocker):
    """Mock the Gemini client to return a predictable JSON response."""
    mock_client = MagicMock()
    mock_models = MagicMock()
    mock_client.models = mock_models

    # Prepare a dummy response for generate_content
    mock_response = MagicMock()
    mock_response.text = '{"skill": "Python", "total_weeks": 4, "phases": [{"phase": 1, "name": "Basics", "weeks": [1], "topics": ["Variables"], "project": "Calc", "description": "Start"}], "daily_schedule": "Study 1 hr", "final_project": "Web App", "job_readiness_checklist": ["Build API"]}'
    
    mock_models.generate_content.return_value = mock_response

    mocker.patch("app.core.gemini.get_ai_client", return_value=mock_client)
    mocker.patch("app.core.gemini.get_gemini_client", return_value=mock_client)

    return mock_client

@pytest.fixture(autouse=True)
def mock_cache(mocker, request):
    """Mock the cache manager to always return the fallback function, except in cache tests."""
    if "test_cache.py" in request.node.fspath.strpath:
        return
        
    async def mock_get_or_set(key, fallback_func, ttl=86400):
        return await fallback_func()
    
    mocker.patch("app.core.cache.CacheManager.get_or_set", side_effect=mock_get_or_set)
