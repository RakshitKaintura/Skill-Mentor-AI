
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from tenacity import RetryError

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.models.schemas import (
    ActiveRoadmapResponse,
    AdvanceRoadmapResponse,
    GenerateRoadmapRequest,
    GenerateRoadmapResponse,
)
from app.services.roadmap_service import RoadmapService

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])

def get_roadmap_service(supabase: Client = Depends(get_supabase)) -> RoadmapService:
    return RoadmapService(supabase)

@router.post("/generate", response_model=GenerateRoadmapResponse, status_code=status.HTTP_201_CREATED)
async def generate_roadmap_endpoint(
    req: GenerateRoadmapRequest, 
    auth_user_id: str = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Architects a personalized learning journey using the Roadmap Agent."""
    try:
        result = await service.generate(req)
        return GenerateRoadmapResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RetryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail='AI model temporary outage or quota limit reached. Please retry in a moment.'
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Generation failed: {e!s}"
        )

@router.get("/{user_id}", response_model=ActiveRoadmapResponse)
async def get_roadmap(
    user_id: str, 
    auth_user_id: str = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Retrieves the latest active roadmap for a specific student."""
    return service.get_roadmap_for_user(user_id)

@router.patch("/{roadmap_id}/advance", response_model=AdvanceRoadmapResponse)
async def advance_roadmap_progress(
    roadmap_id: str, 
    user_id: str, 
    auth_user_id: str = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Updates student progress by advancing the current week and phase."""
    return service.advance_roadmap(roadmap_id, user_id)