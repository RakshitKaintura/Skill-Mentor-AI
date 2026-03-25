"""
SkillMentor AI — FastAPI v3.0.0 (Week 3: Quiz + Playground + Progress).
Final backend orchestration for an Agentic AI Learning Platform.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.gemini import get_gemini_client

# Import specialized AI Agent and service routers
from app.api.routes import (
    health, roadmap, books, lessons, 
    voice, quiz, playground, progress
)

# 1. Lifespan Management: Pre-warms AI resources
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

# 2. App Initialization
app = FastAPI(
    title="SkillMentor AI",
    description="Agentic AI Learning Platform — Week 3 (Quiz + Playground + Progress)",
    version="3.0.0",
    lifespan=lifespan,
    # Documentation is only exposed in development for security
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# 3. CORS Configuration: Sanitizing origins
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

# 4. Route Registration
# Keep both prefixes active for compatibility across frontend modules.
for api_prefix in ("/api", "/v1"):
    app.include_router(health.router,     prefix=api_prefix)
    app.include_router(roadmap.router,    prefix=api_prefix)
    app.include_router(books.router,      prefix=api_prefix)
    app.include_router(lessons.router,    prefix=api_prefix)
    app.include_router(voice.router,      prefix=api_prefix)
    app.include_router(quiz.router,       prefix=api_prefix)
    app.include_router(playground.router, prefix=api_prefix)
    app.include_router(progress.router,   prefix=api_prefix)

# Global Shortcut for health checks (useful for devops/monitoring)
app.include_router(health.router)

@app.get("/", tags=["System"])
async def root():
    """Service discovery endpoint."""
    return {
        "name": "SkillMentor AI",
        "version": "3.0.0",
        "status": "operational",
        "week": 3,
        "engine": "Gemini 3.1 Flash Lite Preview",
        "agents": ["Roadmap", "Lesson", "CodeCoach", "Quiz", "Doubt", "Progress"],
        "capabilities": [
            "AI Curriculum Generation", 
            "RAG-based Tutoring", 
            "Real-time Voice Coaching", 
            "Adaptive Assessments",
            "Interactive Code Playground"
        ]
    }