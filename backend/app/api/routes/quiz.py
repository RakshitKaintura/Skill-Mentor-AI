"""
Quiz & Examiner API Routes — Agent 4
Manages adaptive quiz generation, submission evaluation, and student performance tracking.
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

from app.agents.quiz_agent import generate_quiz, evaluate_quiz
from app.agents.progress_agent import update_topic_mastery
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["Assessment"])

# --- Request Schemas ---

class GenerateQuizRequest(BaseModel):
    user_id: str
    roadmap_id: str
    topic: str
    skill: str
    lesson_id: Optional[str] = None
    week_number: int = 1
    difficulty: str = "beginner"
    num_questions: int = 5

class SubmitQuizRequest(BaseModel):
    quiz_id: str
    user_id: str
    user_answers: List[Dict[str, Any]]
    time_taken: int = 0

# --- API Endpoints ---

@router.post("/generate")
async def generate_quiz_endpoint(req: GenerateQuizRequest):
    """
    Triggers Agent 4 to create a personalized, adaptive quiz.
    Uses RAG and historical performance to tune difficulty.
    """
    try:
        quiz = await generate_quiz(
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
async def submit_quiz_endpoint(req: SubmitQuizRequest, background_tasks: BackgroundTasks):
    """
    Evaluates quiz submissions and triggers background mastery updates.
    Returns immediate feedback and XP rewards to the student.
    """
    try:
        result = await evaluate_quiz(
            quiz_id=req.quiz_id,
            user_id=req.user_id,
            user_answers=req.user_answers,
            time_taken=req.time_taken
        )

        # Background Task: Update Topic Mastery
        # We fetch the topic/skill metadata to ensure the Progress Agent targets the correct domain
        supabase = get_supabase()
        quiz_meta = supabase.table("quizzes").select("topic, skill") \
            .eq("id", req.quiz_id).single().execute()
        
        if quiz_meta.data:
            background_tasks.add_task(
                update_topic_mastery,
                user_id=req.user_id,
                topic=quiz_meta.data["topic"],
                skill=quiz_meta.data["skill"],
                score_pct=result["percentage"]
            )

        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Submission evaluation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate submission.")

@router.get("/user/{user_id}")
async def get_user_quizzes(
    user_id: str, 
    roadmap_id: Optional[str] = None, 
    limit: int = Query(10, le=50)
):
    """Retrieves history of assessments for a specific user."""
    supabase = get_supabase()
    query = supabase.table("quizzes").select("*").eq("user_id", user_id)
    
    if roadmap_id:
        query = query.eq("roadmap_id", roadmap_id)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    return {"quizzes": result.data or []}

@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str):
    """Fetches the full details (questions and solutions) for a specific quiz record."""
    supabase = get_supabase()
    result = supabase.table("quizzes").select("*").eq("id", quiz_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Assessment record not found.")
    
    return result.data