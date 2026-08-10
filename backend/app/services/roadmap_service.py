from typing import Dict, Any, Optional
from supabase import Client
from fastapi import HTTPException, status
from app.models.schemas import GenerateRoadmapRequest, GenerateRoadmapResponse
from app.agents.roadmap_agent import generate_roadmap

class RoadmapService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def generate(self, req: GenerateRoadmapRequest) -> dict:
        """Architects a personalized learning journey using the Roadmap Agent."""
        result = await generate_roadmap(req)
        return result

    def get_roadmap_for_user(self, user_id: str) -> Dict[str, Any]:
        """Retrieves the latest active roadmap for a specific student."""
        result = (
            self.supabase.table("roadmaps")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active roadmap found.")
            
        return result.data[0]

    def advance_roadmap(self, roadmap_id: str, user_id: str) -> Dict[str, Any]:
        """Updates student progress by advancing the current week and phase."""
        response = (
            self.supabase.table("roadmaps")
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
            self.supabase.table("roadmaps")
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
            self.supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": 50}).execute()
        except Exception:
            pass

        return {
            "message": f"Progress updated to Week {next_week}",
            "current_week": next_week,
            "current_topic": active_topic,
            "current_phase": active_phase["name"]
        }
