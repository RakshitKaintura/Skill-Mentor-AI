"""
Project Mentor API Routes — Agent 7
Handles project assignment, senior-level code reviews, and architectural guidance.
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.agents.project_mentor_agent import (
    assign_project, 
    review_project, 
    get_mentor_guidance
)
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["Project Mentorship"])

# --- Request Schemas ---

class AssignRequest(BaseModel):
    user_id: str
    roadmap_id: str
    skill: str
    level: str

class ReviewRequest(BaseModel):
    project_id: str
    user_id: str
    submitted_code: str
    github_url: Optional[str] = None

class HintRequest(BaseModel):
    project_id: str
    question: str

# --- API Endpoints ---

@router.post("/assign")
async def assign_project_endpoint(req: AssignRequest):
    """
    Triggers Agent 7 to generate a comprehensive, level-appropriate 
    technical project specification for the student.
    """
    try:
        project = await assign_project(
            user_id=req.user_id, 
            roadmap_id=req.roadmap_id, 
            skill=req.skill, 
            level=req.level
        )
        return {"success": True, "project": project}
    except Exception as e:
        logger.error(f"Project assignment failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate project specs.")

@router.post("/review")
async def review_project_endpoint(req: ReviewRequest):
    """
    Performs a senior-level AI code review of the submitted project.
    Calculates performance scores and awards XP based on code quality.
    """
    try:
        result = await review_project(
            project_id=req.project_id, 
            user_id=req.user_id, 
            submitted_code=req.submitted_code, 
            github_url=req.github_url
        )
        return {"success": True, "review": result}
    except Exception as e:
        logger.error(f"Project review failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to process code review.")

@router.post("/hint")
async def project_hint_endpoint(req: HintRequest):
    """
    Provides architectural guidance or a 'Mentor Secret' without 
    spoiling the solution.
    """
    try:
        # Aligned with the refactored 'get_mentor_guidance' method name
        hint = await get_mentor_guidance(
            project_id=req.project_id, 
            question=req.question
        )
        return {"success": True, "hint": hint}
    except Exception as e:
        logger.error(f"Mentor guidance failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve mentor hint.")

@router.get("/user/{user_id}")
async def get_user_projects(
    user_id: str, 
    roadmap_id: Optional[str] = None,
    limit: int = Query(20, le=50)
):
    """Retrieves the history of all assigned and submitted projects for a user."""
    supabase = get_supabase()
    query = supabase.table("projects").select("*").eq("user_id", user_id)
    
    if roadmap_id:
        query = query.eq("roadmap_id", roadmap_id)
        
    result = query.order("created_at", desc=True).limit(limit).execute()
    return {"projects": result.data or []}

@router.get("/{project_id}")
async def get_project(project_id: str):
    """Fetches full details of a specific project record."""
    supabase = get_supabase()
    result = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    return result.data