import logging
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.agents.career_prep_agent import (
    check_job_readiness_logic,
    complete_interview_session,
    evaluate_interview_answer,
    generate_mock_interview,
    review_resume_ai,
)
from app.services.certificate_service import generate_skill_certificate

logger = logging.getLogger(__name__)

class CareerService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def start_interview(self, user_id: str, roadmap_id: str | None, skill: str, level: str, interview_type: str, company_target: str | None, num_questions: int) -> dict:
        result = await generate_mock_interview(
            user_id=user_id,
            roadmap_id=roadmap_id,
            skill=skill,
            level=level,
            company_target=company_target,
            interview_type=interview_type,
            num_questions=num_questions,
        )

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
            "interview_title": result.get("interview_title", result.get("title", f"{skill} Interview")),
            "skill": skill,
            "level": level,
            "interview_type": interview_type,
            "company_target": company_target or "General Tech",
            "questions": normalized_questions,
            "total_duration_mins": sum(int(q.get("expected_duration_mins", 5)) for q in normalized_questions),
            "pass_score": 75,
        }
        return interview_payload

    async def evaluate_answer(self, question_text: str, answer: str, key_points: list[str], skill: str, level: str, question_id: int) -> dict:
        return await evaluate_interview_answer(
            question_text=question_text,
            answer=answer,
            key_points=key_points,
            skill=skill,
            level=level,
            question_id=question_id,
        )

    async def complete_interview(self, session_id: str, user_id: str, answers: list[dict[str, Any]], evaluations: list[dict[str, Any]]) -> dict:
        return await complete_interview_session(
            session_id=session_id,
            user_id=user_id,
            answers=answers,
            evaluations=evaluations,
        )

    async def review_resume(self, user_id: str, roadmap_id: str, skill: str, target_role: str, resume_text: str) -> dict:
        review = await review_resume_ai(
            resume_text=resume_text,
            target_role=target_role,
            skill_context=skill
        )
        
        db_payload = {
            "user_id": user_id,
            "roadmap_id": roadmap_id,
            "skill": skill,
            "raw_text": resume_text,
            "ats_score": review.get("ats_score", 0),
            "ai_verdict": review.get("verdict"),
            "critique": review.get("critique"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        self.supabase.table("resumes").upsert(
            db_payload, on_conflict="user_id,roadmap_id"
        ).execute()

        return review

    async def get_job_readiness(self, user_id: str, roadmap_id: str) -> dict:
        return await check_job_readiness_logic(user_id, roadmap_id)

    async def generate_certificate(self, user_id: str, roadmap_id: str, skill: str, level: str, full_name: str) -> dict:
        return await generate_skill_certificate(
            user_id=user_id,
            roadmap_id=roadmap_id,
            skill=skill,
            level=level,
            full_name=full_name
        )

    def verify_certificate(self, verify_code: str) -> dict | None:
        result = self.supabase.table("certificates").select("*").eq("verify_code", verify_code).single().execute()
        return result.data if result.data else None

    def get_interview_history(self, user_id: str, limit: int) -> list:
        result = self.supabase.table("interview_sessions").select("*") \
            .eq("user_id", user_id) \
            .eq("status", "completed") \
            .order("created_at", desc=True) \
            .limit(limit).execute()
        return result.data or []
