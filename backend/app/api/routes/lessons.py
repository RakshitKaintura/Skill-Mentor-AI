"""
Lesson API Routes for SkillMentor AI
- Handles generation, doubt solving, progress tracking, and PDF notes.
- Integrated with Google GenAI 2.0 Flash for high-speed tutoring.
"""
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    GenerateLessonRequest, 
    GenerateLessonResponse,
    LessonCompleteRequest, 
    DoubtRequest, 
    DoubtResponse,
)
from app.agents.lesson_agent import generate_lesson, complete_lesson
from app.agents.doubt_agent import solve_doubt
from app.services.notes_service import generate_lesson_pdf
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.core.database import get_supabase
from app.core.gemini import get_gemini_client  # Standardized Client pattern
from app.core.config import get_settings

router = APIRouter(prefix="/lesson", tags=["Lessons"])
settings = get_settings()

@router.post("/generate", response_model=GenerateLessonResponse)
async def generate_lesson_endpoint(req: GenerateLessonRequest):
    """
    Triggers the RAG + GenAI pipeline to create a structured 6-step lesson.
    Optimized for Gemini 3.1 Flash Lite Preview.
    """
    try:
        result = await generate_lesson(req)
        return GenerateLessonResponse(
            lesson_id=result["lesson_id"],
            topic=result["topic"],
            steps_count=len(result["steps"]),
            message=result["message"],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected generation error: {str(e)}")

@router.post("/doubt", response_model=DoubtResponse)
async def ask_doubt(req: DoubtRequest):
    """
    24/7 Socratic Doubt Solver. 
    Provides tailored explanations and code using the student's uploaded context.
    """
    try:
        return await solve_doubt(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Doubt resolution failed: {str(e)}")

@router.get("/user/{user_id}")
async def list_lessons(user_id: str, limit: int = 30):
    """Retrieves a paginated list of generated lessons for a specific user profile."""
    supabase = get_supabase()
    result = (
        supabase.table("lessons")
        .select("id, topic, week_number, completed, completed_at, created_at, sources_used, key_takeaway")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []

@router.get("/{lesson_id}")
async def get_lesson(lesson_id: str):
    """Fetches the full JSON structure of a lesson, including all pedagogical steps."""
    supabase = get_supabase()
    result = supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Lesson resource not found.")
    
    return result.data

@router.post("/{lesson_id}/complete")
async def mark_complete(lesson_id: str, req: LessonCompleteRequest):
    """Records lesson completion, awards XP, and updates the user's learning streak."""
    try:
        return await complete_lesson(req.user_id, lesson_id, req.time_spent_minutes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Progress update failed: {str(e)}")

@router.post("/{lesson_id}/notes")
async def generate_notes(lesson_id: str, user_id: str = Query(...)):
    """
    Generates high-fidelity PDF study notes.
    Persists the asset to cloud storage and returns the secure public URL.
    """
    try:
        pdf_url = await generate_lesson_pdf(lesson_id, user_id)
        return {
            "lesson_id": lesson_id, 
            "pdf_url": pdf_url, 
            "message": "Your branded study notes are ready for download! 📄"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF engine error: {str(e)}")

@router.get("/stream/{roadmap_id}")
async def stream_lesson_intro(
    roadmap_id: str,
    topic: str = Query(...),
    user_id: str = Query(...),
    skill: str = Query(...),
    level: str = Query("beginner"),
):
    """
    Streams a real-time lesson introduction via Server-Sent Events (SSE).
    Uses the latest Gemini streaming capabilities for a 'live-typed' feel.
    """
    # 1. Fetch context for the intro
    rag_chunks = await retrieve_chunks(
        query=f"{topic} {skill}", 
        user_id=user_id,
        skill_tag=skill.lower(), 
        top_k=3, 
        include_curated=True,
    )
    rag_context = format_rag_context(rag_chunks)

    prompt = f"""
    You are teaching {skill} to a {level} learner. 
    Topic: {topic}.
    
    [CONTEXT]
    {rag_context}
    
    TASK: Write a 3-paragraph introduction explaining:
    1. What it is.
    2. Why it is critical to master.
    3. A brief 'hook' using an analogy.
    
    Tone: Warm, authoritative, and direct (use "you").
    """

    async def event_generator():
        try:
            client = get_gemini_client()
            # New 2026 SDK streaming pattern
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={'stream': True}
            )
            
            for chunk in response:
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" # Essential for Vercel/Nginx proxying
        },
    )