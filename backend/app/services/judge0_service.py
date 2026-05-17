"""
Judge0 Code Execution Service
Submits code to the free Judge0 CE public API and returns real execution results.
Docs: https://ce.judge0.com
"""
import asyncio
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

# Free public Judge0 CE instance — no API key required
JUDGE0_BASE_URL = "https://ce.judge0.com"

# Judge0 CE language IDs for common languages
# Full list: https://ce.judge0.com/languages
LANGUAGE_IDS: dict[str, int] = {
    "python":     71,   # Python 3.8.1
    "python3":    71,
    "javascript": 93,   # JavaScript (Node.js 18.15.0)
    "js":         93,
    "typescript": 94,   # TypeScript 5.0.3
    "ts":         94,
    "java":       62,   # Java (OpenJDK 13.0.1)
    "cpp":        54,   # C++ (GCC 9.2.0)
    "c++":        54,
    "c":          50,   # C (GCC 9.2.0)
    "go":         60,   # Go 1.13.5
    "rust":       73,   # Rust 1.40.0
    "ruby":       72,   # Ruby 2.7.0
    "php":        68,   # PHP 7.4.1
    "bash":       46,   # Bash 5.0.0
    "swift":      83,   # Swift 5.2.3
    "kotlin":     78,   # Kotlin 1.3.70
    "r":          80,   # R 4.0.0
    "sql":        82,   # SQLite 3.31.1
}


def get_language_id(language: str) -> int:
    """Maps a language name string to the Judge0 language ID."""
    lang = language.lower().strip()
    if lang not in LANGUAGE_IDS:
        # Default to Python if unknown
        logger.warning(f"Unknown language '{language}', defaulting to Python (71)")
        return 71
    return LANGUAGE_IDS[lang]


class ExecutionResult:
    """Structured result from Judge0 code execution."""
    def __init__(self, data: dict):
        status = data.get("status", {})
        self.status_id: int = status.get("id", 0)
        self.status_desc: str = status.get("description", "Unknown")
        self.stdout: str = data.get("stdout") or ""
        self.stderr: str = data.get("stderr") or ""
        self.compile_output: str = data.get("compile_output") or ""
        self.message: str = data.get("message") or ""
        self.time: str = data.get("time") or "0"
        self.memory: Optional[int] = data.get("memory")

        # Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer
        # 5=TLE, 6=CE, 7-12=Runtime Errors, 13=Internal Error
        self.accepted: bool = self.status_id == 3
        self.compile_error: bool = self.status_id == 6
        self.runtime_error: bool = self.status_id in range(7, 13)
        self.time_limit: bool = self.status_id == 5

    @property
    def error_output(self) -> str:
        """Returns the most relevant error message for the AI to analyze."""
        if self.compile_output:
            return f"Compilation Error:\n{self.compile_output}"
        if self.stderr:
            return f"Runtime Error:\n{self.stderr}"
        if self.message:
            return self.message
        return ""


async def execute_code(
    source_code: str,
    language: str,
    stdin: str = "",
    timeout_seconds: int = 10,
) -> ExecutionResult:
    """
    Submits code to Judge0 CE and returns the execution result.
    Uses the free public instance at ce.judge0.com.

    Args:
        source_code: The code to execute
        language: Language name (e.g. "python", "javascript")
        stdin: Optional standard input for the program
        timeout_seconds: How long to poll for results

    Returns:
        ExecutionResult with stdout, stderr, status, etc.
    """
    language_id = get_language_id(language)

    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
        "wait": False,  # Async submission
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Submit the code
        try:
            submission_resp = await client.post(
                f"{JUDGE0_BASE_URL}/submissions",
                json=payload,
                headers=headers,
            )
            submission_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Judge0 submission failed: {e.response.status_code} — {e.response.text}")
            raise RuntimeError(f"Code execution service unavailable: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Judge0 connection error: {e}")
            raise RuntimeError("Could not connect to code execution service.")

        token = submission_resp.json().get("token")
        if not token:
            raise RuntimeError("Code execution service did not return a submission token.")

        # 2. Poll for results
        poll_interval = 1.0
        elapsed = 0.0

        while elapsed < timeout_seconds:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            result_resp = await client.get(
                f"{JUDGE0_BASE_URL}/submissions/{token}",
                headers=headers,
                params={"base64_encoded": "false", "fields": "*"},
            )
            result_resp.raise_for_status()
            result_data = result_resp.json()

            status_id = result_data.get("status", {}).get("id", 0)
            # Status 1=In Queue, 2=Processing — keep waiting
            if status_id > 2:
                return ExecutionResult(result_data)

        # Timeout — return a timeout result
        return ExecutionResult({
            "status": {"id": 5, "description": "Time Limit Exceeded"},
            "stdout": "",
            "stderr": "Execution timed out.",
        })


async def run_test_cases(
    source_code: str,
    language: str,
    test_cases: list[dict],
) -> list[dict]:
    """
    Runs a list of test cases against the submitted code.
    Returns per-test-case results with pass/fail status.
    """
    results = []
    for i, tc in enumerate(test_cases):
        stdin = str(tc.get("input", ""))
        expected = str(tc.get("expected_output", "")).strip()
        description = tc.get("description", f"Test {i + 1}")

        try:
            exec_result = await execute_code(source_code, language, stdin=stdin)
            actual = exec_result.stdout.strip()
            passed = actual == expected

            results.append({
                "description": description,
                "passed": passed,
                "actual_output": actual if actual else exec_result.error_output,
                "expected_output": expected,
                "execution_time": exec_result.time,
                "error": exec_result.error_output if not passed else None,
                "status": exec_result.status_desc,
            })
        except Exception as e:
            results.append({
                "description": description,
                "passed": False,
                "actual_output": f"Execution error: {e}",
                "expected_output": expected,
                "execution_time": "0",
                "error": str(e),
                "status": "Error",
            })

    return results
