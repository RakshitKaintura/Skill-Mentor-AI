"""
SkillMentor AI — Logging Configuration
=======================================
Call setup_logging() once during application startup (in main.py).
- Development: human-readable coloured text via basicConfig
- Production:  JSON-structured lines for log aggregators (Datadog, CloudWatch, etc.)

No third-party library required — uses stdlib logging only.
"""
from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import override

# ── JSON formatter ────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    """
    Formats each log record as a single JSON line containing:
    timestamp, level, logger name, message, and any 'extra' fields
    (e.g. trace_id, duration_ms, path) attached at the call site.
    """
    _RESERVED = frozenset({
        "name", "msg", "args", "levelname", "levelno", "pathname",
        "filename", "module", "exc_info", "exc_text", "stack_info",
        "lineno", "funcName", "created", "msecs", "relativeCreated",
        "thread", "threadName", "processName", "process", "message",
    })

    @override
    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        payload: dict = {
            "ts":      datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.message,
        }
        # Attach extra fields (trace_id, path, duration_ms, …)
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


# ── Plain-text formatter (dev) ────────────────────────────────

class DevFormatter(logging.Formatter):
    """Colour-coded plain-text formatter for local development."""
    LEVEL_COLORS = {
        "DEBUG":    "\033[36m",   # cyan
        "INFO":     "\033[32m",   # green
        "WARNING":  "\033[33m",   # yellow
        "ERROR":    "\033[31m",   # red
        "CRITICAL": "\033[35m",   # magenta
    }
    RESET = "\033[0m"

    @override
    def format(self, record: logging.LogRecord) -> str:
        color   = self.LEVEL_COLORS.get(record.levelname, "")
        ts      = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime("%H:%M:%S")
        extra   = ""
        known   = {"name","msg","args","levelname","levelno","pathname","filename","module",
                   "exc_info","exc_text","stack_info","lineno","funcName","created","msecs",
                   "relativeCreated","thread","threadName","processName","process","message",
                   "taskName"}
        for k, v in record.__dict__.items():
            if k not in known and not k.startswith("_"):
                extra += f" | {k}={v}"

        base = (
            f"{color}[{record.levelname:>8}]{self.RESET} "
            f"\033[90m{ts}\033[0m "
            f"\033[94m{record.name}\033[0m — "
            f"{record.getMessage()}{extra}"
        )
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


# ── Public setup function ─────────────────────────────────────

def setup_logging(app_env: str = "development") -> None:
    """
    Configure the root logger once at application startup.
    Call this before creating the FastAPI app so all subsequent
    loggers (uvicorn, fastapi, app.*) inherit the configuration.
    """
    is_production = app_env == "production"
    formatter     = JsonFormatter() if is_production else DevFormatter()
    level         = logging.INFO if is_production else logging.DEBUG

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    # Remove any handlers that uvicorn/pytest may have already added
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Silence noisy third-party loggers
    for noisy in ("httpx", "httpcore", "google.auth", "google.genai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("app").info(
        "Logging initialised",
        extra={"env": app_env, "level": logging.getLevelName(level)},
    )
