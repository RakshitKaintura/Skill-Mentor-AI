from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.services.sandbox_service import SandboxService

router = APIRouter()

class ExecuteRequest(BaseModel):
    language: str = Field(..., description="Programming language (e.g., python, javascript)")
    code: str = Field(..., description="Source code to execute")
    stdin: str = Field(default="", description="Optional standard input")

class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float

def get_sandbox_service() -> SandboxService:
    return SandboxService()

@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(
    req: ExecuteRequest,
    auth_user_id: str = Depends(get_current_user),
    service: SandboxService = Depends(get_sandbox_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    Executes code in a secure sandbox using the Piston public API.
    Used for interactive browser code evaluation.
    """
    result = await service.execute_code(
        language=req.language,
        code=req.code,
        stdin=req.stdin
    )
    return ExecuteResponse(**result)
