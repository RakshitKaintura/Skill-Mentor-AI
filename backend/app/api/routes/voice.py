import asyncio
import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from supabase import Client

from app.core.auth import get_current_ws_user
from app.core.database import get_supabase
from app.services.voice_service import VoiceService

router = APIRouter(prefix="/voice", tags=["Voice"])

def get_voice_service(supabase: Client = Depends(get_supabase)) -> VoiceService:
    return VoiceService(supabase)

@router.websocket("/ws")
async def voice_websocket(
    websocket: WebSocket,
    topic: str = Query(...),
    skill: str = Query(...),
    level: str = Query("beginner"),
    lesson_id: str = Query(default=""),
    socratic: bool = Query(default=False),
    # Note: Dependencies in WebSockets behave a bit differently. We can instantiate it directly to avoid issues or use Depends.
    # FastAPI supports Depends in websockets.
    auth_user_id: str = Depends(get_current_ws_user),
    service: VoiceService = Depends(get_voice_service)
):
    """
    WebSocket entry point for real-time AI tutoring sessions.
    Handles session state, database logging, and error recovery.
    """
    await websocket.accept()
    start_time = asyncio.get_event_loop().time()
    
    # Context-aware instruction injection
    instruction = service.get_instruction(topic, skill, level, socratic)

    try:
        # Initialize the stateful session
        await service.handle_voice_lifecycle(websocket, instruction, topic, skill)
        
    except WebSocketDisconnect:
        # Calculate and log session metrics for user progress analytics
        duration = int(asyncio.get_event_loop().time() - start_time)
        if auth_user_id:
            service.log_session_stats(auth_user_id, lesson_id, topic, skill, duration)
            
    except Exception as e:
        error_msg = {"type": "error", "message": f"Session Interrupted: {e!s}"}
        await websocket.send_text(json.dumps(error_msg))
    finally:
        try:
            await websocket.close()
        except:
            pass