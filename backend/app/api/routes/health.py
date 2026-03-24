import asyncio
from fastapi import APIRouter
from datetime import datetime, timezone
from app.models.schemas import HealthResponse
from app.core.config import get_settings
from app.core.gemini import check_model_health
from app.core.database import get_supabase

router = APIRouter(tags=["System"])

async def check_gemini() -> bool:
    """Verifies LLM availability."""
    return await check_model_health()

async def check_supabase() -> bool:
    """Verifies Supabase connectivity."""
    try:
        supabase = get_supabase()
        # Querying 'profiles' as it's a foundational table
        supabase.table("profiles").select("id").limit(1).execute()
        return True
    except Exception:
        return False

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Performs parallel health checks on core dependencies.
    Satisfies the HealthResponse Pydantic schema validation.
    """
    # Execute checks concurrently for low-latency response
    gemini_ok, supabase_ok = await asyncio.gather(
        check_gemini(),
        check_supabase()
    )

    is_healthy = gemini_ok and supabase_ok

    # FIXED: These keys must match the HealthResponse model fields exactly
    return HealthResponse(
        status="operational" if is_healthy else "degraded",
        gemini_connected=gemini_ok,    # Corrected field name
        supabase_connected=supabase_ok, # Corrected field name
        version="2.1.0",
        timestamp=datetime.now(timezone.utc)
    )