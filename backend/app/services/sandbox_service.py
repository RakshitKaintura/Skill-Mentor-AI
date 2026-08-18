import httpx
from fastapi import HTTPException

# Mapping simplified language names to Piston API requirements
PISTON_LANGUAGE_MAP = {
    "python": {"language": "python", "version": "3.10.0"},
    "javascript": {"language": "javascript", "version": "18.15.0"},
    "js": {"language": "javascript", "version": "18.15.0"},
    "typescript": {"language": "typescript", "version": "5.0.3"},
    "ts": {"language": "typescript", "version": "5.0.3"},
    "c": {"language": "c", "version": "10.2.0"},
    "cpp": {"language": "c++", "version": "10.2.0"},
    "java": {"language": "java", "version": "15.0.2"},
    "go": {"language": "go", "version": "1.16.2"},
    "rust": {"language": "rust", "version": "1.68.2"},
}

class SandboxService:
    async def execute_code(self, language: str, code: str, stdin: str) -> dict:
        lang_key = language.lower()
        if lang_key not in PISTON_LANGUAGE_MAP:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported language: {language}. Supported: {', '.join(PISTON_LANGUAGE_MAP.keys())}"
            )
            
        piston_config = PISTON_LANGUAGE_MAP[lang_key]
        
        payload = {
            "language": piston_config["language"],
            "version": piston_config["version"],
            "files": [{"content": code}],
            "stdin": stdin
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post("https://emkc.org/api/v2/piston/execute", json=payload)
                response.raise_for_status()
                
                data = response.json()
                run_data = data.get("run", {})
                
                return {
                    "stdout": run_data.get("stdout", ""),
                    "stderr": run_data.get("stderr", ""),
                    "exit_code": run_data.get("code", 1),
                    "execution_time_ms": 0.0  # Piston doesn't reliably return execution time in ms in standard run block
                }
                
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Sandbox API Error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Failed to connect to sandbox provider: {e!s}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
