import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.quiz_service import QuizService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["Assessment"])

# --- Request Schemas ---

class GenerateQuizRequest(BaseModel):
    user_id: str
    roadmap_id: str
    topic: str
    skill: str
    lesson_id: str | None = None
    week_number: int = 1
    difficulty: str = "beginner"
    num_questions: int = 5

class SubmitQuizRequest(BaseModel):
    quiz_id: str
    user_id: str
    user_answers: list[dict[str, Any]]
    time_taken: int = 0

def get_quiz_service(supabase: Client = Depends(get_supabase)) -> QuizService:
    return QuizService(supabase)

# --- API Endpoints ---

@router.post("/generate")
async def generate_quiz_endpoint(
    req: GenerateQuizRequest,
    auth_user_id: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Triggers Agent 4 to create a personalized, adaptive quiz.
    Uses RAG and historical performance to tune difficulty.
    """
    try:
        quiz = await service.generate_quiz(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            topic=req.topic,
            skill=req.skill,
            week_number=req.week_number,
            lesson_id=req.lesson_id,
            difficulty=req.difficulty,
            num_questions=req.num_questions
        )
        return {"success": True, "quiz": quiz}
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate assessment.")

@router.post("/submit")
async def submit_quiz_endpoint(
    req: SubmitQuizRequest, 
    background_tasks: BackgroundTasks,
    auth_user_id: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Evaluates quiz submissions and triggers background mastery updates.
    Returns immediate feedback and XP rewards to the student.
    """
    try:
        result = await service.submit_quiz(
            quiz_id=req.quiz_id,
            user_id=req.user_id,
            user_answers=req.user_answers,
            time_taken=req.time_taken,
            background_tasks=background_tasks
        )
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Submission evaluation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate submission.")

@router.get("/user/{user_id}")
async def get_user_quizzes(
    user_id: str, 
    roadmap_id: str | None = None, 
    limit: int = Query(10, le=50),
    auth_user_id: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Retrieves history of assessments for a specific user."""
    quizzes = service.get_user_quizzes(user_id, roadmap_id, limit)
    return {"quizzes": quizzes}

@router.get("/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    auth_user_id: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Fetches the full details (questions and solutions) for a specific quiz record."""
    quiz = service.get_quiz(quiz_id, auth_user_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Assessment record not found.")
    return quiz