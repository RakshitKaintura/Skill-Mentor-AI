from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from supabase import Client

from app.models.schemas import (
    GenerateLessonRequest, 
    GenerateLessonResponse,
    LessonCompleteRequest, 
    DoubtRequest, 
    DoubtResponse,
)
from app.core.database import get_supabase
from app.services.lessons_service import LessonsService

router = APIRouter(prefix="/lesson", tags=["Lessons"])

def get_lessons_service(supabase: Client = Depends(get_supabase)) -> LessonsService:
    return LessonsService(supabase)

@router.post("/generate", response_model=GenerateLessonResponse)
async def generate_lesson_endpoint(
    req: GenerateLessonRequest,
    service: LessonsService = Depends(get_lessons_service)
):
    """
    Triggers the RAG + GenAI pipeline to create a structured 6-step lesson.
    Optimized for Gemini 3.1 Flash Lite Preview.
    """
    try:
        result = await service.generate_lesson(req)
        return GenerateLessonResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected generation error: {str(e)}")

@router.post("/doubt", response_model=DoubtResponse)
async def ask_doubt(
    req: DoubtRequest,
    service: LessonsService = Depends(get_lessons_service)
):
    """
    24/7 Socratic Doubt Solver. 
    Provides tailored explanations and code using the student's uploaded context.
    """
    try:
        return await service.ask_doubt(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Doubt resolution failed: {str(e)}")

@router.delete("/cleanup/{user_id}")
async def cleanup_user_lessons(
    user_id: str,
    service: LessonsService = Depends(get_lessons_service)
):
    """
    Deletes all previous lessons for a user when a new browser session is started.
    This ensures that old generated lessons are not stored permanently.
    """
    try:
        service.cleanup_user_lessons(user_id)
        return {"message": "Lessons cleaned up for new session", "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup lessons: {str(e)}")

@router.get("/user/{user_id}")
async def list_lessons(
    user_id: str, 
    limit: int = 30,
    service: LessonsService = Depends(get_lessons_service)
):
    """Retrieves a paginated list of generated lessons for a specific user profile."""
    return service.list_lessons(user_id, limit)

@router.get("/{lesson_id}")
async def get_lesson(
    lesson_id: str,
    service: LessonsService = Depends(get_lessons_service)
):
    """Fetches the full JSON structure of a lesson, including all pedagogical steps."""
    lesson = service.get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson resource not found.")
    return lesson

@router.post("/{lesson_id}/complete")
async def mark_complete(
    lesson_id: str, 
    req: LessonCompleteRequest,
    service: LessonsService = Depends(get_lessons_service)
):
    """Records lesson completion, awards XP, and updates the user's learning streak."""
    try:
        return await service.mark_complete(lesson_id, req.user_id, req.time_spent_minutes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Progress update failed: {str(e)}")

@router.post("/{lesson_id}/notes")
async def generate_notes(
    lesson_id: str, 
    user_id: str = Query(...),
    service: LessonsService = Depends(get_lessons_service)
):
    """
    Generates high-fidelity PDF study notes.
    Persists the asset to cloud storage and returns the secure public URL.
    """
    try:
        pdf_url = await service.generate_notes(lesson_id, user_id)
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
    service: LessonsService = Depends(get_lessons_service)
):
    """
    Streams a real-time lesson introduction via Server-Sent Events (SSE).
    Uses the latest Gemini streaming capabilities for a 'live-typed' feel.
    """
    generator = service.stream_lesson_intro_generator(roadmap_id, topic, user_id, skill, level)
    
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        },
    )