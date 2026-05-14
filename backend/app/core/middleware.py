"""
SkillMentor AI — ASGI Middleware
=================================
Two middlewares registered in main.py:

1. CorrelationIDMiddleware
   - Reads X-Request-ID from incoming request headers (or generates uuid4)
   - Stores it in a ContextVar so it is accessible anywhere in the request
     lifecycle via get_request_id()
   - Echoes it back in the response X-Request-ID header

2. GlobalExceptionHandler
   - Catches ALL unhandled exceptions at the ASGI boundary
   - Formats them into the structured ErrorResponse schema
   - Sanitises internal error details in production
   - Logs structured error lines with trace_id, path, method, duration_ms

Registration order in main.py (outermost middleware added LAST):
    app.add_middleware(GlobalExceptionHandler)   ← catches everything
    app.add_middleware(CorrelationIDMiddleware)   ← injects trace ID first
"""
from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar
from typing import Awaitable, Callable

from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.exceptions import (
    ErrorDetail,
    ErrorResponse,
    SkillMentorError,
)
from app.core.config import get_settings

logger = logging.getLogger("app.middleware")

# ── ContextVar for correlation ID ─────────────────────────────

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """
    Returns the correlation ID for the current async request context.
    Safe to call from anywhere in the request lifecycle:
        logger.error("boom", extra={"trace_id": get_request_id()})
    """
    return _request_id_ctx.get() or "no-trace"


# ── 1. Correlation ID Middleware ──────────────────────────────

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Injects a request-scoped correlation ID into every request/response.
    Uses the client-supplied X-Request-ID if present, otherwise generates
    a new UUID4. The ID is stored in an asyncio ContextVar so it propagates
    safely across async awaits without thread-safety concerns.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Honour client-supplied ID (useful for distributed tracing)
        trace_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token    = _request_id_ctx.set(trace_id)

        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)

        response.headers["X-Request-ID"] = trace_id
        return response


# ── 2. Global Exception Handler ───────────────────────────────

class GlobalExceptionHandler(BaseHTTPMiddleware):
    """
    Catches all unhandled exceptions at the ASGI boundary and converts
    them into structured JSON error responses.

    Priority order:
      1. SkillMentorError subclasses  → use their declared http_status / error_code
      2. RequestValidationError        → 422 VALIDATION_ERROR (Pydantic schema failures)
      3. HTTPException                 → preserve status code, wrap in ErrorResponse
      4. Everything else               → 500 INTERNAL_ERROR (message scrubbed in prod)
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._settings = get_settings()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start      = time.monotonic()
        trace_id   = get_request_id()

        try:
            return await call_next(request)

        except SkillMentorError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.error(
                "[%s] %s %s | trace=%s | %dms | %s",
                exc.error_code,
                request.method,
                request.url.path,
                trace_id,
                duration_ms,
                exc.message,
                exc_info=exc,
                extra={
                    "trace_id":    trace_id,
                    "error_code":  exc.error_code,
                    "path":        request.url.path,
                    "method":      request.method,
                    "duration_ms": duration_ms,
                },
            )
            return self._build_response(exc.http_status, exc.error_code, exc.message, trace_id)

        except RequestValidationError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            # Safe to include validation details — they describe the request, not internals
            messages = "; ".join(
                f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}"
                for e in exc.errors()
            )
            logger.warning(
                "[VALIDATION_ERROR] %s %s | trace=%s | %dms | %s",
                request.method, request.url.path, trace_id, duration_ms, messages,
                extra={"trace_id": trace_id, "error_code": "VALIDATION_ERROR",
                       "path": request.url.path, "method": request.method,
                       "duration_ms": duration_ms},
            )
            return self._build_response(422, "VALIDATION_ERROR", messages, trace_id)

        except Exception as exc:  # noqa: BLE001
            duration_ms = int((time.monotonic() - start) * 1000)
            # Determine if this is a FastAPI HTTPException (not in our hierarchy)
            status_code = getattr(exc, "status_code", 500)
            detail      = getattr(exc, "detail", None)

            if status_code != 500 and detail is not None:
                # Passthrough for intentional HTTPException raises (404, 403, etc.)
                error_code = f"HTTP_{status_code}"
                client_msg = str(detail)
                log_level  = logger.warning
            else:
                error_code = "INTERNAL_ERROR"
                # NEVER leak raw exception text to clients in production
                client_msg = (
                    str(exc)
                    if self._settings.app_env != "production"
                    else "An unexpected internal error occurred. Please try again."
                )
                log_level = logger.error

            log_level(
                "[%s] %s %s | trace=%s | %dms | %s",
                error_code,
                request.method,
                request.url.path,
                trace_id,
                duration_ms,
                str(exc),
                exc_info=(status_code == 500),
                extra={
                    "trace_id":    trace_id,
                    "error_code":  error_code,
                    "path":        request.url.path,
                    "method":      request.method,
                    "duration_ms": duration_ms,
                },
            )
            return self._build_response(status_code, error_code, client_msg, trace_id)

    @staticmethod
    def _build_response(
        status_code: int,
        error_code:  str,
        message:     str,
        trace_id:    str,
    ) -> JSONResponse:
        body = ErrorResponse(
            error=ErrorDetail(
                code=error_code,
                message=message,
                trace_id=trace_id,
            )
        )
        return JSONResponse(
            status_code=status_code,
            content=body.model_dump(),
            headers={"X-Request-ID": trace_id},
        )
