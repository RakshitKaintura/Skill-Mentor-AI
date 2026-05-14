"""
SkillMentor AI — FastAPI v4.0.0 (The Complete Agentic Suite)
Final backend orchestration for all 8 AI Agents.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

from app.core.config import get_settings
from app.core.gemini import get_gemini_client
from app.core.logging_config import setup_logging
from app.core.middleware import CorrelationIDMiddleware, GlobalExceptionHandler

# 1. Comprehensive Agent & Service Route Imports
from app.api.routes import (
    health, roadmap, books, lessons,
    voice, quiz, playground, progress,
    daily,
    projects, career,
    analytics, admin,
    stream, notes,
)

# 2. Lifespan Management: Pre-warms AI resources
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown orchestration. 
    Ensures Gemini connectivity is validated before the first request is processed.
    """
    try:
        # Pre-initialize and validate the Gemini Client
        _ = get_gemini_client()
        print("🚀 SkillMentor AI: Gemini 3.1 Flash Lite Preview Client Initialized")
        print("✅ All 11 Modules (Learning Agents + Analytics + Admin) are standing by.")
    except Exception as e:
        settings = get_settings()
        if settings.app_env == "development":
            print(f"⚠️ Startup Warning: Gemini validation skipped: {e}")
        else:
            print(f"❌ Startup Critical Error: {e}")
            raise
    
    yield
    print("🛑 SkillMentor AI: Shutting down backend service")

settings = get_settings()

# ── Logging must be configured before any logger calls ───────
setup_logging(settings.app_env)

# 3. App Initialization
app = FastAPI(
    title="SkillMentor AI",
    description="Full-Stack Agentic AI Learning Platform — v4.0.0",
    version="4.0.0",
    lifespan=lifespan,
    # Documentation is only exposed in development for security
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# 3.5 Rate Limiting Configuration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# 3.6 Observability Middleware
# Order: CorrelationIDMiddleware runs first (injects trace ID into ContextVar);
# GlobalExceptionHandler wraps everything and can access the trace ID.
app.add_middleware(GlobalExceptionHandler)
app.add_middleware(CorrelationIDMiddleware)

# 4. CORS Configuration: Sanitizing origins
# Professional practice: Strip trailing slashes to prevent browser CORS blocks
origins = [
    settings.frontend_url.rstrip("/"),
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Route Registration
# We use a centralized loop to register all agent routers with the /api prefix.
agent_routers = [
    health.router, roadmap.router, books.router, lessons.router,
    voice.router, quiz.router, playground.router, progress.router,
    daily.router,
    projects.router, career.router,
    analytics.router, admin.router,
    stream.router, notes.router,
]

for router in agent_routers:
    # Health checks stay at root; agents are versioned under /api
    prefix = "/api" if router != health.router else ""
    app.include_router(router, prefix=prefix)

@app.get("/", tags=["System"])
async def root():
    """Service discovery and capability overview."""
    return {
        "name": "SkillMentor AI",
        "version": "4.0.0",
        "status": "Operational - Learning, Analytics, and Admin Active",
        "engine": "Gemini 3.1 Flash Lite Preview",
        "agents": [
            "Roadmap Architect", "Lesson Teacher", "Code Coach", 
            "Quiz Examiner", "Doubt Solver", "Progress Tracker",
            "Daily Challenge Coach", "Project Mentor", "Career Prep",
            "Analytics Tracker", "Admin Insights"
        ],
        "capabilities": [
            "Dynamic Curriculum Generation",
            "RAG-Powered Technical Tutoring",
            "Real-Time Voice Coaching",
            "Adaptive Assessments",
            "Socratic Code Playground",
            "Industry Project Mentorship",
            "AI Career Coaching & Verified Certification",
            "Event Analytics & Engagement Metrics",
            "Admin Dashboard APIs"
        ]
    }