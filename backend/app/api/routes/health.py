import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends
from supabase import Client

from app.models.schemas import HealthResponse
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.health_service import HealthService

logger   = logging.getLogger("app.health")
router   = APIRouter(tags=["System"])
settings = get_settings()

# ── Process start time for uptime_seconds ─────────────────────
_PROCESS_START = time.monotonic()


def get_health_service(supabase: Client = Depends(get_supabase)) -> HealthService:
    return HealthService(supabase)


async def check_rate_limiter(request: Request) -> bool:
    """
    Verifies the slowapi rate limiter is registered on app.state.
    This catches misconfiguration issues during startup.
    """
    try:
        return hasattr(request.app.state, "limiter")
    except Exception:
        return False


# ── Health endpoint ───────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health_check(
    request: Request,
    service: HealthService = Depends(get_health_service)
):
    """
    Parallel health check across all 6 platform dependencies.
    Returns structured status with per-check boolean flags,
    uptime_seconds, and checks_ms latency for monitoring dashboards.
    """
    check_start = time.monotonic()

    (
        gemini_ok, supabase_ok, storage_ok, rag_ok, notes_ok, limiter_ok,
    ) = await asyncio.gather(
        service.check_gemini(),
        service.check_supabase(),
        service.check_storage(),
        service.check_rag(),
        service.check_notes(),
        check_rate_limiter(request),
    )

    checks_ms    = int((time.monotonic() - check_start) * 1000)
    uptime_secs  = time.monotonic() - _PROCESS_START

    # Status logic
    if not supabase_ok:
        status = "down"
    elif not gemini_ok or not storage_ok:
        status = "degraded"
    else:
        status = "operational"

    logger.info(
        "Health check | status=%s | checks_ms=%d | gemini=%s supabase=%s "
        "storage=%s rag=%s notes=%s limiter=%s",
        status, checks_ms,
        gemini_ok, supabase_ok, storage_ok, rag_ok, notes_ok, limiter_ok,
        extra={
            "status":    status,
            "checks_ms": checks_ms,
            "gemini":    gemini_ok,
            "supabase":  supabase_ok,
            "storage":   storage_ok,
            "rag":       rag_ok,
            "notes":     notes_ok,
        },
    )

    return HealthResponse(
        status             = status,
        version            = "4.0.0",
        environment        = settings.app_env,
        timestamp          = datetime.now(timezone.utc),
        uptime_seconds     = round(uptime_secs, 1),
        checks_ms          = checks_ms,
        gemini_connected   = gemini_ok,
        supabase_connected = supabase_ok,
        storage_connected  = storage_ok,
        rag_ready          = rag_ok,
        notes_ready        = notes_ok,
    )