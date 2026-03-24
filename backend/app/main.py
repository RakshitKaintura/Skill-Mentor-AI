from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, roadmap, books, lessons, voice
from app.core.gemini import get_gemini_client

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
        # In development, we might want to start even if AI is offline
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
    title="SkillMentor AI — Backend API",
    description="Agentic AI learning platform powered by Gemini 3.1 Flash Lite Preview",
    version="2.1.0",
    lifespan=lifespan,
    # Documentation is only exposed in development for security
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# 3. CORS Configuration: Sanitizing origins
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

# 4. Route Registration
# We use versioned prefixes (/v1) for core business logic to allow future API evolution
app.include_router(health.router,  prefix="/v1")
app.include_router(roadmap.router, prefix="/v1")
app.include_router(books.router,   prefix="/v1")
app.include_router(lessons.router, prefix="/v1")
app.include_router(voice.router,   prefix="/v1")

# Global Shortcuts (Useful for load balancers and container health checks)
app.include_router(health.router)

@app.get("/", tags=["System"])
async def root():
    """Service landing point for verification and system status."""
    return {
        "service": "SkillMentor AI API",
        "status": "operational",
        "version": "2.1.0",
        "engine": "Gemini 3.1 Flash Lite Preview",
        "environment": settings.app_env,
        "capabilities": ["Roadmaps", "RAG-based Lessons", "Doubt Solving", "Voice Coaching"]
    }