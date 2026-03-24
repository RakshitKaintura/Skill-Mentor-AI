from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List
from tenacity import RetryError
from app.models.schemas import (
    GenerateRoadmapRequest, 
    GenerateRoadmapResponse
)
from app.agents.roadmap_agent import generate_roadmap
from app.core.database import get_supabase

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])

@router.post("/generate", response_model=GenerateRoadmapResponse, status_code=status.HTTP_201_CREATED)
async def generate_roadmap_endpoint(req: GenerateRoadmapRequest):
    """Architects a personalized learning journey using the Roadmap Agent."""
    try:
        # The agent handles AI generation and initial DB insertion
        result = await generate_roadmap(req)
        return GenerateRoadmapResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RetryError as e:
        inner = e.last_attempt.exception() if hasattr(e, 'last_attempt') else None
        detail = 'AI model temporary outage or quota limit reached. Please retry in a moment.'
        if inner:
            detail += f' ({str(inner)})'
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    except Exception as e:
        # Logging would capture the full traceback here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Generation failed: {str(e)}"
        )

@router.get("/{user_id}", response_model=Dict[str, Any])
async def get_roadmap(user_id: str):
    """Retrieves the latest active roadmap for a specific student."""
    supabase = get_supabase()
    
    # Corrected: 'desc' is a boolean in the Supabase-py order() method
    result = (
        supabase.table("roadmaps")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active roadmap found.")
        
    return result.data[0]

@router.patch("/{roadmap_id}/advance")
async def advance_roadmap_progress(roadmap_id: str, user_id: str):
    """Updates student progress by advancing the current week and phase."""
    supabase = get_supabase()

    # Fetch current state with aliases for compatibility
    response = (
        supabase.table("roadmaps")
        .select("current_week, total_duration, total_weeks, phases, skill")
        .eq("id", roadmap_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap not found.")

    data = response.data
    current_week = data["current_week"]
    # Handle the potential name mismatch between total_duration and total_weeks
    total_weeks = data.get("total_duration") or data.get("total_weeks") or 12

    if current_week >= total_weeks:
        return {"message": "Mastery reached! This roadmap is complete.", "completed": True}

    # Calculate next milestone
    next_week = current_week + 1
    phases = data["phases"]
    
    # Better: Find phase using the synchronized 'duration_weeks' OR 'weeks'
    active_phase = next(
        (p for p in phases if next_week in (p.get("duration_weeks") or p.get("weeks") or [])), 
        phases[-1]
    )
    
    # Get the first topic of the new phase or default to the skill name
    active_topic = active_phase["topics"][0] if active_phase.get("topics") else data["skill"]

    # Atomic Update
    (
        supabase.table("roadmaps")
        .update({
            "current_week": next_week,
            "current_phase": active_phase["name"],
            "current_topic": active_topic,
        })
        .eq("id", roadmap_id)
        .execute()
    )

    # Reward XP for progress via Supabase RPC (Function must exist in SQL)
    try:
        supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": 50}).execute()
    except Exception:
        # If RPC isn't set up yet, we don't want to crash the whole progress update
        pass

    return {
        "message": f"Progress updated to Week {next_week}",
        "current_week": next_week,
        "current_topic": active_topic,
        "current_phase": active_phase["name"]
    }