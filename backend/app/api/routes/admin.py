"""Admin analytics routes — platform insights."""
import logging
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from supabase import Client

from app.core.database import get_supabase
from app.services.admin_service import AdminService

logger   = logging.getLogger(__name__)
router   = APIRouter(prefix="/admin", tags=["admin"])

def get_admin_service(supabase: Client = Depends(get_supabase)) -> AdminService:
    return AdminService(supabase)

@router.get("/stats")
async def all_stats(
    x_admin_key: Optional[str] = Header(default=None),
    service: AdminService = Depends(get_admin_service)
):
    service.verify_admin(x_admin_key)
    return await service.get_all_stats()


@router.get("/engagement")
async def engagement(
    days: int = 7, 
    x_admin_key: Optional[str] = Header(default=None),
    service: AdminService = Depends(get_admin_service)
):
    service.verify_admin(x_admin_key)
    return {"engagement": await service.get_engagement(days)}


@router.get("/funnel")
async def funnel(
    x_admin_key: Optional[str] = Header(default=None),
    service: AdminService = Depends(get_admin_service)
):
    service.verify_admin(x_admin_key)
    return {"funnel": await service.get_funnel()}


@router.get("/skills")
async def skills(
    x_admin_key: Optional[str] = Header(default=None),
    service: AdminService = Depends(get_admin_service)
):
    service.verify_admin(x_admin_key)
    return {"skills": await service.get_skills()}