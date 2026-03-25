// Week 3 types — Quiz, Playground, Progress

export type QuizType = 'lesson' | 'weekly' | 'spaced_repetition'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type QuestionType = 'mcq' | 'true_false' | 'code_output'

export interface QuizQuestion {
  id: number
  type: QuestionType
  question: string
  code_snippet?: string
  options: string[]
  correct_answer: string
  explanation: string
  difficulty: string
  points: number
}

export interface Quiz {
  quiz_id: string
  topic: string
  skill: string
  difficulty: Difficulty
  questions: QuizQuestion[]
  total_points: number
  time_limit_secs: number
  pass_threshold: number
  completed?: boolean
}

export interface QuizResult {
  quiz_id: string
  score: number
  total_points: number
  percentage: number
  passed: boolean
  xp_awarded: number
  feedback: string
  results: QuestionResult[]
  time_taken: number
}

export interface QuestionResult {
  question_id: number
  question: string
  user_answer: string | null
  correct_answer: string
  is_correct: boolean
  points_earned: number
  points_max: number
  explanation: string
}

export interface CodeChallenge {
  challenge_id: string
  title: string
  description: string
  starter_code: string
  test_cases: TestCase[]
  hints: Hint[]
  difficulty: Difficulty
  language: string
  expected_time_minutes: number
}

export interface TestCase {
  input: string
  expected_output: string
  description: string
}

export interface Hint {
  level: number
  hint: string
}

export interface EvaluationResult {
  passed: boolean
  test_results: TestResult[]
  tests_passed: number
  tests_total: number
  code_quality: {
    score: number
    readable: boolean
    efficient: boolean
    comments: string[]
  }
  feedback: {
    what_went_well: string
    what_to_improve: string
    learning_insight: string
  }
  overall_feedback: string
  xp_awarded: number
}

export interface TestResult {
  test_id: number
  description: string
  passed: boolean
  actual_output: string
  expected_output: string
}

export interface ReportCard {
  week_number: number
  skill: string
  overall_grade: string
  grade_reasoning: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  motivational_message: string
  next_week_focus: string
  lessons_done: number
  quizzes_done: number
  challenges_done: number
  avg_score: number
  streak: number
  xp_total: number
  pdf_url?: string
}

export interface LeaderboardEntry {
  id: string
  full_name: string
  current_skill: string
  xp_points: number
  streak_days: number
  lessons_completed: number
  rank: number
}

export interface DueReview {
  topic: string
  skill: string
  interval_days: number
  repetitions: number
}