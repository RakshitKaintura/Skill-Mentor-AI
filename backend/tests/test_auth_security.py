import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.core.database import get_supabase

client = TestClient(app)

def test_protected_route_missing_token():
    response = client.post("/api/roadmap/generate", json={
        "user_id": "test_user",
        "skill": "Python",
        "level": "beginner",
        "goal": "get_job",
        "hours_per_day": 2.0
    })
    assert response.status_code == 401
    assert "Missing authentication token" in response.text or "Not authenticated" in response.text

def test_protected_route_invalid_token(mocker):
    mock_supabase = MagicMock()
    mock_supabase.auth.get_user.side_effect = Exception("Invalid token")
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    response = client.post("/api/roadmap/generate", json={
        "user_id": "test_user",
        "skill": "Python",
        "level": "beginner",
        "goal": "get_job",
        "hours_per_day": 2.0
    }, headers={"Authorization": "Bearer badtoken"})
    
    assert response.status_code == 401
    assert "Invalid or expired authentication token" in response.text
    
    app.dependency_overrides.clear()

def test_protected_route_idor(mocker):
    mock_supabase = MagicMock()
    mock_user = MagicMock()
    mock_user.user.id = "user_A"
    mock_supabase.auth.get_user.return_value = mock_user
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    response = client.post("/api/roadmap/generate", json={
        "user_id": "user_B",
        "skill": "Python",
        "level": "beginner",
        "goal": "get_job",
        "hours_per_day": 2.0
    }, headers={"Authorization": "Bearer goodtoken"})
    
    assert response.status_code == 403
    assert "Not authorized" in response.text
    
    app.dependency_overrides.clear()

def test_admin_route_security():
    response = client.get("/api/admin/stats")
    assert response.status_code == 401
    assert "Unauthorized" in response.text
