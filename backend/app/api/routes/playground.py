"""
Code Playground Coach API Routes — Agent 3
Handles generation of coding challenges, Socratic hinting, and AI-driven code evaluation.
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.agents.code_coach_agent import (
    generate_challenge, 
    get_personalized_hint, 
    evaluate_submission, 
    explain_error
)
from app.services.judge0_service import execute_code, get_language_id

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
    error_message: Optional[str] = None

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

# --- API Endpoints ---

@router.post("/challenge/generate")
async def generate_challenge_endpoint(req: ChallengeRequest):
    """
    Triggers Agent 3 to create a hands-on coding challenge.
    Uses RAG to ensure the challenge matches the specific curriculum topic.
    """
    try:
        challenge = await generate_challenge(
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
async def get_hint_endpoint(req: HintRequest):
    """
    Provides a Socratic hint tailored to the student's current code state.
    Prevents "over-helping" by analyzing exactly where the student is stuck.
    """
    try:
        hint = await get_personalized_hint(
            challenge_id=req.challenge_id, 
            user_code=req.user_code, 
            hint_level=req.hint_level,
            error_message=req.error_message
        )
        return {"success": True, "hint": hint}
    except Exception as e:
        logger.error(f"Personalized hint failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve hint.")

@router.post("/evaluate")
async def evaluate_code_endpoint(req: EvaluateRequest):
    """
    Submits student code for AI evaluation and simulated test case execution.
    Updates progress and awards XP upon successful completion.
    """
    try:
        result = await evaluate_submission(
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
async def explain_error_endpoint(req: ErrorExplainRequest):
    """
    Translates cryptic compiler/runtime errors into plain English learning insights.
    """
    try:
        explanation = await explain_error(
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
async def execute_code_endpoint(req: ExecuteRequest):
    """
    Runs code in the Judge0 CE sandbox and returns real stdout/stderr.
    This powers the "Run" button in the Playground before a formal submission.
    """
    try:
        result = await execute_code(
            source_code=req.source_code,
            language=req.language,
            stdin=req.stdin,
        )
        return {
            "success": True,
            "accepted": result.accepted,
            "stdout": result.stdout,
            "stderr": result.error_output,
            "status": result.status_desc,
            "time": result.time,
            "memory": result.memory,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Code execution error: {e}")
        raise HTTPException(status_code=500, detail="Code execution service error.")

@router.get("/challenge/user/{user_id}")
async def get_user_challenges(user_id: str, roadmap_id: Optional[str] = None):
    """Retrieves a history of coding challenges attempted by the student."""
    from app.core.database import get_supabase
    supabase = get_supabase()
    
    query = supabase.table("code_challenges").select("*").eq("user_id", user_id)
    if roadmap_id:
        query = query.eq("roadmap_id", roadmap_id)
        
    result = query.order("created_at", desc=True).limit(20).execute()
    return {"challenges": result.data or []}