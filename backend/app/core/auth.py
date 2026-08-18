import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, WebSocket, WebSocketException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.core.config import get_settings
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

def verify_admin_key(x_admin_key: str = Header(default=None)) -> bool:
    """Verifies that the provided admin key matches the server configuration."""
    settings = get_settings()
    if not x_admin_key or x_admin_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized — invalid admin key"
        )
    return True

def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    supabase: Client = Depends(get_supabase)
) -> str:
    """
    Extracts the JWT from the Authorization header or token query parameter,
    validates it against Supabase Auth, and returns the authenticated user's ID.
    """
    token = credentials.credentials if credentials else request.query_params.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        # supabase.auth.get_user automatically validates the JWT token with the Supabase API
        # Because we use the service_key in get_supabase, we are making an admin call, 
        # but get_user strictly validates the provided JWT string and fetches that user's identity.
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise ValueError("Invalid user response")
        return user_resp.user.id
    except Exception as e:
        logger.warning(f"Authentication failed: {e!s}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_ws_user(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase)
) -> str:
    """Authenticates a WebSocket connection using a token query parameter."""
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        
    try:
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise ValueError("Invalid user response")
        return user_resp.user.id
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e!s}")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
