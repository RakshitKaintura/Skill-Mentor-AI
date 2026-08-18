import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.playground_service import PlaygroundService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playground", tags=["Playground"])

# --- Request Schemas ---

class ChallengeRequest(BaseModel):
    user_id: str
    roadmap_id: str
    lesson_id: str
    topic: str
    skill: str
    difficulty: str = "beginner"
    language: str = "javascript"

class HintRequest(BaseModel):
    challenge_id: str
    user_id: str
    user_code: str
    hint_level: int = 1
    error_message: str | None = None

class EvaluateRequest(BaseModel):
    challenge_id: str
    user_id: str
    user_code: str
    hints_used: int = 0

class ErrorExplainRequest(BaseModel):
    error_message: str
    code: str
    language: str = "javascript"
    topic: str

class ExecuteRequest(BaseModel):
    """Direct code execution request — runs code in Judge0 sandbox and returns real output."""
    source_code: str
    language: str = "javascript"
    stdin: str = ""

def get_playground_service(supabase: Client = Depends(get_supabase)) -> PlaygroundService:
    return PlaygroundService(supabase)

# --- API Endpoints ---

@router.post("/challenge/generate")
async def generate_challenge_endpoint(
    req: ChallengeRequest,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Triggers Agent 3 to create a hands-on coding challenge.
    Uses RAG to ensure the challenge matches the specific curriculum topic.
    """
    try:
        challenge = await service.generate_challenge(
            user_id=req.user_id, 
            roadmap_id=req.roadmap_id,
            lesson_id=req.lesson_id, 
            topic=req.topic, 
            skill=req.skill,
            difficulty=req.difficulty, 
            language=req.language
        )
        return {"success": True, "challenge": challenge}
    except Exception as e:
        logger.error(f"Challenge generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create coding challenge.")

@router.post("/hint")
async def get_hint_endpoint(
    req: HintRequest,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Provides a Socratic hint tailored to the student's current code state.
    Prevents "over-helping" by analyzing exactly where the student is stuck.
    """
    try:
        hint = await service.get_hint(
            challenge_id=req.challenge_id, 
            user_code=req.user_code, 
            hint_level=req.hint_level,
            error_message=req.error_message,
            user_id=req.user_id
        )
        return {"success": True, "hint": hint}
    except Exception as e:
        logger.error(f"Personalized hint failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve hint.")

@router.post("/evaluate")
async def evaluate_code_endpoint(
    req: EvaluateRequest,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Submits student code for AI evaluation and simulated test case execution.
    Updates progress and awards XP upon successful completion.
    """
    try:
        result = await service.evaluate_code(
            challenge_id=req.challenge_id, 
            user_id=req.user_id,
            user_code=req.user_code, 
            hints_used=req.hints_used
        )
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Submission evaluation failure: {e}")
        raise HTTPException(status_code=500, detail="Evaluation service error.")

@router.post("/explain-error")
async def explain_error_endpoint(
    req: ErrorExplainRequest,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Translates cryptic compiler/runtime errors into plain English learning insights.
    """
    try:
        explanation = await service.explain_error(
            error_message=req.error_message, 
            code=req.code,
            language=req.language, 
            topic=req.topic
        )
        return {"success": True, "explanation": explanation}
    except Exception as e:
        logger.error(f"Error explanation failure: {e}")
        raise HTTPException(status_code=500, detail="Explanation service error.")

@router.post("/execute")
async def execute_code_endpoint(
    req: ExecuteRequest,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Runs code in the Judge0 CE sandbox and returns real stdout/stderr.
    This powers the "Run" button in the Playground before a formal submission.
    """
    try:
        result = await service.execute_code(
            source_code=req.source_code,
            language=req.language,
            stdin=req.stdin,
        )
        return {"success": True, **result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Code execution error: {e}")
        raise HTTPException(status_code=500, detail="Code execution service error.")

@router.get("/challenge/user/{user_id}")
async def get_user_challenges(
    user_id: str, 
    roadmap_id: str | None = None,
    auth_user_id: str = Depends(get_current_user),
    service: PlaygroundService = Depends(get_playground_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Retrieves a history of coding challenges attempted by the student."""
    challenges = service.get_user_challenges(user_id, roadmap_id)
    return {"challenges": challenges}