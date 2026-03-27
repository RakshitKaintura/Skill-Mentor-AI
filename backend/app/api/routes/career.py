"""
Career Prep API Routes — Agent 8
Handles mock interviews, AI resume audits, job readiness scoring, and certification.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.agents.career_prep_agent import (
    generate_mock_interview, 
    review_resume_ai, 
    check_job_readiness_logic,
    evaluate_interview_answer,
    complete_interview_session,
)
from app.services.certificate_service import generate_skill_certificate
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/career", tags=["Career Acceleration"])

# --- Request Schemas ---

class InterviewStartRequest(BaseModel):
    user_id: str
    roadmap_id: Optional[str] = None
    skill: str
    level: str
    interview_type: str = "technical"
    company_target: Optional[str] = None
    num_questions: int = 8


class InterviewAnswerEvalRequest(BaseModel):
    session_id: str
    question_id: int
    question_text: str
    answer: str
    key_points: List[str]
    skill: str
    level: str


class InterviewCompleteRequest(BaseModel):
    session_id: str
    user_id: str
    answers: List[Dict[str, Any]]
    evaluations: List[Dict[str, Any]]

class ResumeReviewRequest(BaseModel):
    user_id: str
    roadmap_id: str
    skill: str
    target_role: str
    resume_text: str  # Updated to match Agent 8 refactor

class CertificateRequest(BaseModel):
    user_id: str
    roadmap_id: str
    skill: str
    level: str
    full_name: str

# --- API Endpoints ---

@router.post("/interview/start")
async def start_interview_endpoint(req: InterviewStartRequest):
    """Generates an adaptive mock interview session based on user skill and history."""
    try:
        result = await generate_mock_interview(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            skill=req.skill,
            level=req.level,
            company_target=req.company_target,
            interview_type=req.interview_type,
            num_questions=req.num_questions,
        )

        # Normalize shape to frontend contract.
        normalized_questions = []
        for idx, q in enumerate(result.get("questions", []), start=1):
            normalized_questions.append({
                "id": q.get("id", idx),
                "type": q.get("type", "concept"),
                "question": q.get("question", ""),
                "difficulty": q.get("difficulty", "medium"),
                "expected_duration_mins": q.get("expected_duration_mins", q.get("time_limit_mins", 5)),
                "key_points": q.get("key_points", q.get("expected_key_points", [])),
                "follow_up": q.get("follow_up"),
            })

        interview_payload = {
            "session_id": result.get("session_id"),
            "interview_title": result.get("interview_title", result.get("title", f"{req.skill} Interview")),
            "skill": req.skill,
            "level": req.level,
            "interview_type": req.interview_type,
            "company_target": req.company_target or "General Tech",
            "questions": normalized_questions,
            "total_duration_mins": sum(int(q.get("expected_duration_mins", 5)) for q in normalized_questions),
            "pass_score": 75,
        }
        return {"success": True, "interview": interview_payload}
    except Exception as e:
        logger.error(f"Interview generation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to start interview session.")


@router.post("/interview/evaluate-answer")
async def evaluate_interview_answer_endpoint(req: InterviewAnswerEvalRequest):
    """Evaluates a single interview answer in real-time."""
    try:
        evaluation = await evaluate_interview_answer(
            question_text=req.question_text,
            answer=req.answer,
            key_points=req.key_points,
            skill=req.skill,
            level=req.level,
            question_id=req.question_id,
        )
        return {"success": True, "evaluation": evaluation}
    except Exception as e:
        logger.error(f"Interview answer evaluation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate interview answer.")


@router.post("/interview/complete")
async def complete_interview_endpoint(req: InterviewCompleteRequest):
    """Completes interview session, computes summary, and awards XP."""
    try:
        summary = await complete_interview_session(
            session_id=req.session_id,
            user_id=req.user_id,
            answers=req.answers,
            evaluations=req.evaluations,
        )
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error(f"Interview completion failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete interview session.")

@router.post("/resume/review")
async def resume_review_endpoint(req: ResumeReviewRequest):
    """Performs an AI audit of a resume for ATS optimization and technical depth."""
    try:
        review = await review_resume_ai(
            resume_text=req.resume_text,
            target_role=req.target_role,
            skill_context=req.skill
        )
        
        # Persistence Logic
        supabase = get_supabase()
        db_payload = {
            "user_id": req.user_id,
            "roadmap_id": req.roadmap_id,
            "skill": req.skill,
            "raw_text": req.resume_text,
            "ats_score": review.get("ats_score", 0),
            "ai_verdict": review.get("verdict"),
            "critique": review.get("critique"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table("resumes").upsert(
            db_payload, on_conflict="user_id,roadmap_id"
        ).execute()

        return {"success": True, "review": review}
    except Exception as e:
        logger.error(f"Resume review failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to process resume audit.")

@router.get("/job-readiness/{user_id}")
async def get_job_readiness(user_id: str, roadmap_id: str):
    """Calculates the weighted job-readiness score across all platform activities."""
    try:
        result = await check_job_readiness_logic(user_id, roadmap_id)
        return {"success": True, "readiness": result}
    except Exception as e:
        logger.error(f"Readiness calculation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate readiness score.")

@router.post("/certificate/generate")
async def generate_cert_endpoint(req: CertificateRequest):
    """Generates a verified, branded PDF certificate for skill completion."""
    try:
        # Aligned with refactored 'generate_skill_certificate'
        cert = await generate_skill_certificate(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            skill=req.skill,
            level=req.level,
            full_name=req.full_name
        )
        return {"success": True, "certificate": cert}
    except Exception as e:
        logger.error(f"Certificate generation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate certificate.")

@router.get("/certificate/verify/{verify_code}")
async def verify_certificate(verify_code: str):
    """Public verification endpoint for recruiters to validate certificates."""
    supabase = get_supabase()
    result = supabase.table("certificates").select("*").eq("verify_code", verify_code).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid verification code.")
        
    return {"valid": True, "certificate": result.data}

@router.get("/interview/history/{user_id}")
async def get_interview_history(user_id: str, limit: int = Query(10, le=50)):
    """Retrieves previous mock interview performance summaries."""
    supabase = get_supabase()
    result = supabase.table("interview_sessions").select("*") \
        .eq("user_id", user_id) \
        .eq("status", "completed") \
        .order("created_at", desc=True) \
        .limit(limit).execute()
        
    return {"sessions": result.data or []}