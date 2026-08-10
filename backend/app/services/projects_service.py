import logging
from typing import Optional, List, Dict, Any
from supabase import Client

from app.agents.project_mentor_agent import (
    assign_project, 
    review_project, 
    get_mentor_guidance
)

logger = logging.getLogger(__name__)

class ProjectsService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def assign_project(self, user_id: str, roadmap_id: str, skill: str, level: str) -> dict:
        return await assign_project(
            user_id=user_id, 
            roadmap_id=roadmap_id, 
            skill=skill, 
            level=level
        )

    async def review_project(self, project_id: str, user_id: str, submitted_code: str, github_url: Optional[str]) -> dict:
        return await review_project(
            project_id=project_id, 
            user_id=user_id, 
            submitted_code=submitted_code, 
            github_url=github_url
        )

    async def get_hint(self, project_id: str, question: str) -> dict:
        return await get_mentor_guidance(
            project_id=project_id, 
            question=question
        )

    def get_user_projects(self, user_id: str, roadmap_id: Optional[str], limit: int) -> list:
        query = self.supabase.table("projects").select("*").eq("user_id", user_id)
        if roadmap_id:
            query = query.eq("roadmap_id", roadmap_id)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data or []

    def get_project(self, project_id: str) -> Optional[dict]:
        result = self.supabase.table("projects").select("*").eq("id", project_id).single().execute()
        return result.data if result.data else None
