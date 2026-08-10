from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

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
    service: SandboxService = Depends(get_sandbox_service)
):
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
