// Week 4 types — Projects, Career, Certificate

export interface Project {
  project_id:       string
  title:            string
  description:      string
  requirements:     string[]
  tech_stack:       string[]
  starter_hints:    string[]
  expected_outcome: string
  estimated_hours:  number
  level:            string
  skill:            string
  status?:          'assigned' | 'in_progress' | 'submitted' | 'reviewed'
}

export interface ProjectReview {
  score:                number
  grade:                string
  requirements_check:   RequirementCheck[]
  code_quality:         CodeQuality
  what_went_well:       string[]
  what_to_improve:      ImprovementItem[]
  overall_feedback:     string
  next_steps:           string[]
  xp_awarded:           number
}

export interface RequirementCheck {
  requirement: string
  met:         boolean
  comment:     string
}

export interface CodeQuality {
  readability:    number
  structure:      number
  best_practices: number
  comments:       string[]
}

export interface ImprovementItem {
  issue:       string
  where:       string
  how_to_fix:  string
}

export interface InterviewQuestion {
  id:                    number
  type:                  'concept' | 'coding' | 'behavioral' | 'system_design'
  question:              string
  difficulty:            string
  expected_duration_mins: number
  key_points:            string[]
  follow_up?:            string | null
}

export interface InterviewSession {
  session_id:      string
  interview_title: string
  skill:           string
  level:           string
  interview_type:  string
  company_target:  string
  questions:       InterviewQuestion[]
  total_duration_mins: number
  pass_score:      number
}

export interface AnswerEvaluation {
  question_id:          number
  score:                number
  verdict:              'Excellent' | 'Good' | 'Needs Work' | 'Poor'
  what_was_good:        string
  what_was_missing:     string
  ideal_answer_summary: string
}

export interface InterviewSummary {
  session_id:       string
  overall_score:    number
  job_ready:        boolean
  overall_feedback: string
  strengths:        string[]
  improvements:     Array<{ area: string; action: string }>
  study_plan:       string[]
  encouragement:    string
  xp_awarded:       number
}

export interface ResumeData {
  full_name?: string
  email?:     string
  phone?:     string
  linkedin?:  string
  github?:    string
  summary?:   string
  skills?:    string[]
  projects?:  ResumeProject[]
  experience?: ResumeExperience[]
  education?: ResumeEducation[]
}

export interface ResumeProject {
  name:        string
  description: string
  tech:        string[]
  link?:       string
}

export interface ResumeExperience {
  company:   string
  role:      string
  duration:  string
  bullets:   string[]
}

export interface ResumeEducation {
  institution: string
  degree:      string
  year:        string
}

export interface ResumeReview {
  overall_score:    number
  ats_score:        number
  section_scores:   Record<string, number>
  strengths:        string[]
  suggestions:      Array<{ section: string; issue: string; fix: string }>
  missing_keywords: string[]
  overall_feedback: string
}

export interface JobReadiness {
  readiness_score: number
  job_ready:       boolean
  checklist:       Array<{ item: string; done: boolean; value: number | string }>
  avg_quiz:        number
  avg_project:     number
  avg_interview:   number
  lessons_done:    number
  xp_total:        number
  message:         string
}

export interface Certificate {
  id:          string
  pdf_url:     string
  verify_code: string
  skill:       string
  level:       string
  full_name:   string
  issued_at?:  string
}