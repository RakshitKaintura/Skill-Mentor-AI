import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase
from app.services.projects_service import ProjectsService

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

def get_projects_service(supabase: Client = Depends(get_supabase)) -> ProjectsService:
    return ProjectsService(supabase)

# --- API Endpoints ---

@router.post("/assign")
async def assign_project_endpoint(
    req: AssignRequest,
    service: ProjectsService = Depends(get_projects_service)
):
    """
    Triggers Agent 7 to generate a comprehensive, level-appropriate 
    technical project specification for the student.
    """
    try:
        project = await service.assign_project(
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
async def review_project_endpoint(
    req: ReviewRequest,
    service: ProjectsService = Depends(get_projects_service)
):
    """
    Performs a senior-level AI code review of the submitted project.
    Calculates performance scores and awards XP based on code quality.
    """
    try:
        result = await service.review_project(
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
async def project_hint_endpoint(
    req: HintRequest,
    service: ProjectsService = Depends(get_projects_service)
):
    """
    Provides architectural guidance or a 'Mentor Secret' without 
    spoiling the solution.
    """
    try:
        hint = await service.get_hint(
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
    limit: int = Query(20, le=50),
    service: ProjectsService = Depends(get_projects_service)
):
    """Retrieves the history of all assigned and submitted projects for a user."""
    projects = service.get_user_projects(user_id, roadmap_id, limit)
    return {"projects": projects}

@router.get("/{project_id}")
async def get_project(
    project_id: str,
    service: ProjectsService = Depends(get_projects_service)
):
    """Fetches full details of a specific project record."""
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project