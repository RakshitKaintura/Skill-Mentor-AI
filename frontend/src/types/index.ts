/**
 * SkillMentor AI — Core Type Definitions
 * Synchronized with March 2026 Backend Schemas
 */

// ── Auth & Profiles ────────────────────────────────────────
export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url?: string
  current_skill?: string
  onboarding_completed: boolean
  created_at: string
}

// ── Roadmap ────────────────────────────────────────────────
export type SkillLevel = 'beginner' | 'some' | 'intermediate' | 'advanced'
export type LearnerGoal = 'get_job' | 'freelance' | 'build_project' | 'exam' | 'upskill'

export interface RoadmapPhase {
  phase_number: number
  phase?: number            // Alias fix
  name: string
  duration_weeks: number[]
  weeks?: number[]          // Alias fix
  topics: string[]
  milestone_project: string
  project?: string          // Alias fix
  description: string
  completed?: boolean       // Missing property fix
}

export interface Roadmap {
  id: string
  user_id: string
  skill: string
  level: SkillLevel
  goal: LearnerGoal
  hours_per_day: number
  total_duration: number
  total_weeks?: number      // Alias fix
  current_week: number
  current_phase: string
  current_topic: string
  phases: RoadmapPhase[]
  daily_routine: string
  daily_schedule?: string   // Alias fix
  capstone_project: string
  final_project?: string    // Alias fix
  readiness_checklist: string[]
  job_readiness_checklist?: string[] // Alias fix
  created_at: string
}

// ── Lesson ─────────────────────────────────────────────────
export type LessonStepType = 'intro' | 'analogy' | 'code_demo' | 'try_it' | 'common_mistakes' | 'summary'

export interface LessonStep {
  step_type: LessonStepType
  type?: LessonStepType     // Alias fix
  title: string
  content: string
  code_snippet?: string
  language?: string
}

export interface Lesson {
  id: string
  roadmap_id: string
  user_id: string
  topic: string
  week_number: number
  phase_name: string
  steps: LessonStep[]
  key_takeaway: string
  next_topic?: string
  completed: boolean
  created_at: string
}

// ── Knowledge Base (RAG) ───────────────────────────────────
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface UserBook {
  id: string
  user_id: string
  file_name: string
  skill_tag: string
  processing_status: ProcessingStatus
  total_chunks?: number
  topics_detected?: string[]
  file_size_bytes: number
  created_at: string
}

// ── Gamification & Progress ────────────────────────────────
export interface UserProgress {
  user_id: string
  xp_points: number
  streak_days: number
  last_active_date: string
  lessons_completed: number
  total_study_minutes: number
  badges_earned: string[]
}