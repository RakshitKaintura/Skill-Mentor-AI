import pytest
from unittest.mock import patch
from app.agents.roadmap_agent import generate_roadmap
from app.models.schemas import GenerateRoadmapRequest, LearnerGoal, SkillLevel

@pytest.mark.anyio
@patch("app.agents.roadmap_agent.llm_router.generate_json")
async def test_generate_roadmap_success(mock_llm_generate, mock_gemini, mock_supabase):
    """
    Test that the generate_roadmap agent properly calls the LLM, 
    parses the JSON response, saves to Supabase, and returns the correct payload.
    """
    
    mock_llm_generate.return_value = '{"skill": "Python", "total_weeks": 4, "phases": [{"phase": 1, "name": "Basics", "weeks": [1], "topics": ["Variables"], "project": "Calc", "description": "Start"}], "daily_schedule": "Study 1 hr", "final_project": "Web App", "job_readiness_checklist": ["Build API"]}'
    
    req = GenerateRoadmapRequest(
        user_id="test-user-123",
        skill="Python",
        level=SkillLevel.beginner,
        goal=LearnerGoal.build_project,
        hours_per_day=2
    )

    # Run the function
    result = await generate_roadmap(req)

    # Verify the result
    assert result["roadmap_id"] == "test-roadmap-id"
    assert result["total_weeks"] == 4
    assert result["phases_count"] == 1

    # Verify Supabase was called to save the roadmap
    mock_supabase.table.assert_any_call("roadmaps")
    mock_supabase.table.assert_any_call("user_progress")
