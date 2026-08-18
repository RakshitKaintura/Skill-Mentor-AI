"""Admin analytics routes — platform insights."""
import logging

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import verify_admin_key
from app.core.database import get_supabase
from app.services.admin_service import AdminService

logger   = logging.getLogger(__name__)
router   = APIRouter(prefix="/admin", tags=["admin"])

def get_admin_service(supabase: Client = Depends(get_supabase)) -> AdminService:
    return AdminService(supabase)

@router.get("/stats", dependencies=[Depends(verify_admin_key)])
async def all_stats(
    service: AdminService = Depends(get_admin_service)
):
    return await service.get_all_stats()


@router.get("/engagement", dependencies=[Depends(verify_admin_key)])
async def engagement(
    days: int = 7, 
    service: AdminService = Depends(get_admin_service)
):
    return {"engagement": await service.get_engagement(days)}


@router.get("/funnel", dependencies=[Depends(verify_admin_key)])
async def funnel(
    service: AdminService = Depends(get_admin_service)
):
    return {"funnel": await service.get_funnel()}


@router.get("/skills", dependencies=[Depends(verify_admin_key)])
async def skills(
    service: AdminService = Depends(get_admin_service)
):
    return {"skills": await service.get_skills()}