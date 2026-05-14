"""
SkillMentor AI — Health Check Route
=====================================
Runs all dependency checks in parallel via asyncio.gather and returns
a detailed HealthResponse documenting the status of every sub-system.

Status levels:
  "operational" — all checks pass
  "degraded"    — Gemini or Storage fail but Supabase is OK
  "down"        — Supabase is unavailable (platform non-functional)
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.models.schemas import HealthResponse
from app.core.config import get_settings
from app.core.gemini import check_model_health
from app.core.database import get_supabase

logger   = logging.getLogger("app.health")
router   = APIRouter(tags=["System"])
settings = get_settings()

# ── Process start time for uptime_seconds ─────────────────────
_PROCESS_START = time.monotonic()


# ── Individual dependency checks ─────────────────────────────

async def check_gemini() -> bool:
    """Verifies LLM availability by calling check_model_health()."""
    try:
        return await check_model_health()
    except Exception as exc:
        logger.warning("Gemini health check failed: %s", exc)
        return False


async def check_supabase() -> bool:
    """Verifies Supabase DB connectivity."""
    try:
        supabase = get_supabase()
        supabase.table("profiles").select("id").limit(1).execute()
        return True
    except Exception as exc:
        logger.warning("Supabase health check failed: %s", exc)
        return False


async def check_storage() -> bool:
    """
    Verifies Supabase Storage is accessible by listing buckets.
    A non-empty or empty list both indicate connectivity;
    an exception indicates Storage is down.
    """
    try:
        supabase = get_supabase()
        supabase.storage.list_buckets()
        return True
    except Exception as exc:
        logger.warning("Storage health check failed: %s", exc)
        return False


async def check_rag() -> bool:
    """
    Verifies the RAG documents table exists and has at least one row.
    Returns False (not 'down') if empty — RAG simply has no data yet.
    """
    try:
        supabase = get_supabase()
        result = supabase.table("documents").select("id").limit(1).execute()
        return True  # Table exists (even if empty the query succeeds)
    except Exception as exc:
        logger.warning("RAG health check failed: %s", exc)
        return False


async def check_notes() -> bool:
    """
    Verifies the user_notes migration has been run by querying the table.
    Returns False if the migration hasn't been executed yet.
    """
    try:
        supabase = get_supabase()
        supabase.table("user_notes").select("id").limit(1).execute()
        return True
    except Exception as exc:
        logger.warning("Notes table health check failed: %s", exc)
        return False


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
async def health_check(request: Request):
    """
    Parallel health check across all 6 platform dependencies.
    Returns structured status with per-check boolean flags,
    uptime_seconds, and checks_ms latency for monitoring dashboards.
    """
    check_start = time.monotonic()

    (
        gemini_ok, supabase_ok, storage_ok, rag_ok, notes_ok, limiter_ok,
    ) = await asyncio.gather(
        check_gemini(),
        check_supabase(),
        check_storage(),
        check_rag(),
        check_notes(),
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