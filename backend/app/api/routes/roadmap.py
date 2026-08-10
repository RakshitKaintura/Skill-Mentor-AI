from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any
from tenacity import RetryError
from supabase import Client
from app.models.schemas import (
    GenerateRoadmapRequest, 
    GenerateRoadmapResponse
)
from app.core.database import get_supabase
from app.services.roadmap_service import RoadmapService

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])

def get_roadmap_service(supabase: Client = Depends(get_supabase)) -> RoadmapService:
    return RoadmapService(supabase)

@router.post("/generate", response_model=GenerateRoadmapResponse, status_code=status.HTTP_201_CREATED)
async def generate_roadmap_endpoint(
    req: GenerateRoadmapRequest, 
    service: RoadmapService = Depends(get_roadmap_service)
):
    """Architects a personalized learning journey using the Roadmap Agent."""
    try:
        result = await service.generate(req)
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Generation failed: {str(e)}"
        )

@router.get("/{user_id}", response_model=Dict[str, Any])
async def get_roadmap(
    user_id: str, 
    service: RoadmapService = Depends(get_roadmap_service)
):
    """Retrieves the latest active roadmap for a specific student."""
    return service.get_roadmap_for_user(user_id)

@router.patch("/{roadmap_id}/advance")
async def advance_roadmap_progress(
    roadmap_id: str, 
    user_id: str, 
    service: RoadmapService = Depends(get_roadmap_service)
):
    """Updates student progress by advancing the current week and phase."""
    return service.advance_roadmap(roadmap_id, user_id)