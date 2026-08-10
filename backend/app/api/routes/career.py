import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase
from app.services.career_service import CareerService

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
    resume_text: str

class CertificateRequest(BaseModel):
    user_id: str
    roadmap_id: str
    skill: str
    level: str
    full_name: str

def get_career_service(supabase: Client = Depends(get_supabase)) -> CareerService:
    return CareerService(supabase)

# --- API Endpoints ---

@router.post("/interview/start")
async def start_interview_endpoint(
    req: InterviewStartRequest,
    service: CareerService = Depends(get_career_service)
):
    """Generates an adaptive mock interview session based on user skill and history."""
    try:
        interview = await service.start_interview(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            skill=req.skill,
            level=req.level,
            interview_type=req.interview_type,
            company_target=req.company_target,
            num_questions=req.num_questions
        )
        return {"success": True, "interview": interview}
    except Exception as e:
        logger.error(f"Interview generation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to start interview session.")

@router.post("/interview/evaluate-answer")
async def evaluate_interview_answer_endpoint(
    req: InterviewAnswerEvalRequest,
    service: CareerService = Depends(get_career_service)
):
    """Evaluates a single interview answer in real-time."""
    try:
        evaluation = await service.evaluate_answer(
            question_text=req.question_text,
            answer=req.answer,
            key_points=req.key_points,
            skill=req.skill,
            level=req.level,
            question_id=req.question_id
        )
        return {"success": True, "evaluation": evaluation}
    except Exception as e:
        logger.error(f"Interview answer evaluation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate interview answer.")

@router.post("/interview/complete")
async def complete_interview_endpoint(
    req: InterviewCompleteRequest,
    service: CareerService = Depends(get_career_service)
):
    """Completes interview session, computes summary, and awards XP."""
    try:
        summary = await service.complete_interview(
            session_id=req.session_id,
            user_id=req.user_id,
            answers=req.answers,
            evaluations=req.evaluations
        )
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error(f"Interview completion failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete interview session.")

@router.post("/resume/review")
async def resume_review_endpoint(
    req: ResumeReviewRequest,
    service: CareerService = Depends(get_career_service)
):
    """Performs an AI audit of a resume for ATS optimization and technical depth."""
    try:
        review = await service.review_resume(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            skill=req.skill,
            target_role=req.target_role,
            resume_text=req.resume_text
        )
        return {"success": True, "review": review}
    except Exception as e:
        logger.error(f"Resume review failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to process resume audit.")

@router.get("/job-readiness/{user_id}")
async def get_job_readiness(
    user_id: str, 
    roadmap_id: str,
    service: CareerService = Depends(get_career_service)
):
    """Calculates the weighted job-readiness score across all platform activities."""
    try:
        result = await service.get_job_readiness(user_id, roadmap_id)
        return {"success": True, "readiness": result}
    except Exception as e:
        logger.error(f"Readiness calculation failure: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate readiness score.")

@router.post("/certificate/generate")
async def generate_cert_endpoint(
    req: CertificateRequest,
    service: CareerService = Depends(get_career_service)
):
    """Generates a verified, branded PDF certificate for skill completion."""
    try:
        cert = await service.generate_certificate(
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
async def verify_certificate(
    verify_code: str,
    service: CareerService = Depends(get_career_service)
):
    """Public verification endpoint for recruiters to validate certificates."""
    cert = service.verify_certificate(verify_code)
    if not cert:
        raise HTTPException(status_code=404, detail="Invalid verification code.")
    return {"valid": True, "certificate": cert}

@router.get("/interview/history/{user_id}")
async def get_interview_history(
    user_id: str, 
    limit: int = Query(10, le=50),
    service: CareerService = Depends(get_career_service)
):
    """Retrieves previous mock interview performance summaries."""
    history = service.get_interview_history(user_id, limit)
    return {"sessions": history}