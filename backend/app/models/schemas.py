from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
from datetime import datetime, timezone



# ── Enums ──────────────────────────────────────────────────
class SkillLevel(str, Enum):
    beginner     = "beginner"
    some         = "some"
    intermediate = "intermediate"


class LearnerGoal(str, Enum):
    get_job       = "get_job"
    freelance     = "freelance"
    build_project = "build_project"
    exam          = "exam"
    upskill       = "upskill"


class ProcessingStatus(str, Enum):
    pending    = "pending"
    processing = "processing"
    completed  = "completed"
    failed     = "failed"


# ── Roadmap models ─────────────────────────────────────────
class RoadmapPhase(BaseModel):
    phase:       int
    name:        str
    weeks:       list[int]
    topics:      list[str]
    project:     str
    description: str


class GeneratedRoadmap(BaseModel):
    skill:                    str
    total_weeks:              int = Field(ge=4, le=24)
    phases:                   list[RoadmapPhase]
    daily_schedule:           str
    final_project:            str
    job_readiness_checklist:  list[str]


class GenerateRoadmapRequest(BaseModel):
    user_id:       str
    skill:         str
    level:         SkillLevel
    goal:          LearnerGoal
    hours_per_day: float = Field(ge=0.5, le=8.0)


class GenerateRoadmapResponse(BaseModel):
    roadmap_id:   str
    message:      str
    total_weeks:  int
    phases_count: int


# ── Book models ────────────────────────────────────────────
class BookUploadResponse(BaseModel):
    book_id:   str
    file_name: str
    status:    ProcessingStatus
    message:   str


class BookStatusResponse(BaseModel):
    book_id:         str
    file_name:       str
    status:          ProcessingStatus
    total_chunks:    Optional[int]       = None
    topics_detected: Optional[list[str]] = None
    error_message:   Optional[str]       = None


# ── Lesson models ──────────────────────────────────────────
class LessonStepType(str, Enum):
    intro     = "intro"
    analogy   = "analogy"
    code_demo = "code_demo"
    try_it    = "try_it"
    mistakes  = "mistakes"
    summary   = "summary"


class LessonStep(BaseModel):
    type:         LessonStepType
    title:        str
    content:      str
    code_snippet: Optional[str] = None
    language:     Optional[str] = None


class GeneratedLesson(BaseModel):
    topic:        str
    skill:        str
    week_number:  int
    phase_name:   str
    steps:        list[LessonStep]
    sources_used: list[str]
    key_takeaway: str
    next_topic:   str


class GenerateLessonRequest(BaseModel):
    user_id:     str
    roadmap_id:  str
    topic:       str
    skill:       str
    level:       str
    phase_name:  str
    week_number: int = 1


class GenerateLessonResponse(BaseModel):
    lesson_id:   str
    topic:       str
    steps_count: int
    message:     str


class LessonCompleteRequest(BaseModel):
    user_id:            str
    lesson_id:          str
    time_spent_minutes: int = 0


# ── Doubt models ───────────────────────────────────────────
class DoubtRequest(BaseModel):
    user_id:    str
    lesson_id:  Optional[str] = None
    session_id: Optional[str] = None   # Groups multiple turns into one conversation
    topic:      str
    skill:      str
    question:   str


class DoubtResponse(BaseModel):
    answer:       str
    analogy:      str
    code_example: Optional[str] = None


# ── Health ─────────────────────────────────────────────────
class HealthResponse(BaseModel):
    # Core status
    status:             str        # "operational" | "degraded" | "down"
    version:            str        = "4.0.0"
    environment:        str        = "development"
    timestamp:          datetime   = Field(default_factory=lambda: datetime.now(timezone.utc))
    uptime_seconds:     float      = 0.0   # seconds since process start
    checks_ms:          int        = 0     # how long health checks took

    # Dependency checks
    gemini_connected:   bool       = False
    supabase_connected: bool       = False
    storage_connected:  bool       = False  # Supabase Storage bucket accessible
    rag_ready:          bool       = False  # RAG documents table has data
    notes_ready:        bool       = False  # user_notes migration has run