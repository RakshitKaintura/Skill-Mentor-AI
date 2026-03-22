from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, roadmap, books
from app.core.gemini import get_ai_client, validate_gemini_startup

# 1. Lifespan Management: Pre-warms AI resources
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown. 
    Ensures Gemini is ready before the first request hits.
    """
    try:
        _ = get_ai_client()
        await validate_gemini_startup()
        print("🚀 SkillMentor AI: Gemini Client Initialized and Validated")
    except Exception as e:
        if settings.app_env == "development" and settings.allow_start_without_gemini:
            print(f"⚠️ Startup Warning: Gemini validation skipped in development mode: {e}")
        else:
            print(f"❌ Startup Error: {e}")
            raise
    
    yield
    
    print("🛑 SkillMentor AI: Shutting down backend service")

settings = get_settings()

# 2. App Initialization
app = FastAPI(
    title="SkillMentor AI — Backend API",
    description="Agentic AI learning platform powered by Gemini 3.1 Flash",
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# 3. CORS Configuration: Sanitizing origins
# We strip trailing slashes to prevent common browser CORS blocks
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
# Standard Versioned Routes
app.include_router(health.router, prefix="/v1")
app.include_router(roadmap.router, prefix="/v1")
app.include_router(books.router, prefix="/v1")

# Global Health Shortcut (Allows /health and /v1/health to both work)
# This is useful for load balancers and container health checks
app.include_router(health.router)

@app.get("/", tags=["System"])
async def root():
    """Service landing point for verification."""
    return {
        "service": "SkillMentor AI API",
        "status": "active",
        "version": "2.1.0",
        "environment": settings.app_env
    }