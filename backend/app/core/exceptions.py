"""
SkillMentor AI — Custom Exception Hierarchy
============================================
Domain-specific exceptions that map to precise HTTP status codes
without coupling business logic directly to FastAPI/HTTP concerns.

Usage in agents:
    from app.core.exceptions import AgentError, ResourceNotFoundError
    raise AgentError("Gemini returned empty response after 3 retries")

The GlobalExceptionHandler in middleware.py catches all of these
and serialises them into the structured ErrorResponse schema.
"""
from __future__ import annotations

from pydantic import BaseModel


# ── Structured error models ───────────────────────────────────

class ErrorDetail(BaseModel):
    """The body of every error response from the API."""
    code:     str   # machine-readable, e.g. "AGENT_ERROR"
    message:  str   # human-readable, safe for clients
    trace_id: str   # correlation ID from X-Request-ID header


class ErrorResponse(BaseModel):
    """Top-level wrapper matching the documented API error schema."""
    error: ErrorDetail


# ── Base exception ────────────────────────────────────────────

class SkillMentorError(Exception):
    """
    Base class for all application-level exceptions.
    Subclasses declare their own http_status and error_code so the
    middleware can map them to correct HTTP responses without any
    switch-case logic in the handler itself.
    """
    http_status: int = 500
    error_code:  str = "INTERNAL_ERROR"

    def __init__(self, message: str = "An internal error occurred") -> None:
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return self.message


# ── Concrete exception types ──────────────────────────────────

class AgentError(SkillMentorError):
    """
    An AI agent (Gemini) failed to produce a valid response.
    Examples: timeout, malformed JSON, empty model response.
    Maps to 503 so clients know the issue is upstream, not their request.
    """
    http_status = 503
    error_code  = "AGENT_ERROR"


class AppValidationError(SkillMentorError):
    """
    Request data is semantically invalid beyond what Pydantic catches.
    Example: week_number > total_weeks in a roadmap request.
    Maps to 422 Unprocessable Entity.
    Note: named AppValidationError to avoid shadowing pydantic.ValidationError.
    """
    http_status = 422
    error_code  = "VALIDATION_ERROR"


class ResourceNotFoundError(SkillMentorError):
    """
    A requested database record does not exist.
    Example: lesson_id not found in lessons table.
    Maps to 404.
    """
    http_status = 404
    error_code  = "NOT_FOUND"


class ExternalServiceError(SkillMentorError):
    """
    A third-party dependency (Supabase, Storage, external API) failed.
    Maps to 502 Bad Gateway — the server received an invalid upstream response.
    """
    http_status = 502
    error_code  = "EXTERNAL_SERVICE_ERROR"


class RateLimitError(SkillMentorError):
    """
    The client has exceeded their request quota.
    Maps to 429 Too Many Requests.
    """
    http_status = 429
    error_code  = "RATE_LIMITED"


class AuthorizationError(SkillMentorError):
    """
    The authenticated user is not permitted to perform the action.
    Maps to 403 Forbidden.
    """
    http_status = 403
    error_code  = "FORBIDDEN"
