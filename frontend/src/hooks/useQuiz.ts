'use client'
import { useState, useCallback, useRef } from 'react'
import type { Quiz, QuizResult } from '@/types/week3'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function useQuiz() {
  const [quiz, setQuiz]         = useState<Quiz | null>(null)
  const [result, setResult]     = useState<QuizResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers]   = useState<Record<number, string>>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const getErrorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Unexpected error')

  const normalizeQuiz = (raw: Record<string, unknown>): Quiz => {
    const questions = Array.isArray(raw.questions) ? (raw.questions as Quiz['questions']) : []
    const totalPoints = typeof raw.total_points === 'number'
      ? raw.total_points
      : questions.reduce((sum, q) => sum + (typeof q.points === 'number' ? q.points : 10), 0)

    return {
      quiz_id: String(raw.quiz_id ?? raw.id ?? ''),
      topic: String(raw.topic ?? 'Quiz'),
      skill: String(raw.skill ?? 'General'),
      difficulty: (String(raw.difficulty ?? 'beginner') as Quiz['difficulty']),
      questions,
      total_points: totalPoints,
      time_limit_secs: typeof raw.time_limit_secs === 'number' ? raw.time_limit_secs : 300,
      pass_threshold: typeof raw.pass_threshold === 'number' ? raw.pass_threshold : 70,
      completed: Boolean(raw.completed),
    }
  }

  const generateQuiz = useCallback(async (params: {
    user_id: string
    roadmap_id: string
    lesson_id?: string
    topic: string
    skill: string
    week_number?: number
    difficulty?: string
    quiz_type?: string
  }) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setAnswers({})
    try {
      const res = await fetch(`${API}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Failed to generate quiz')
      setQuiz(data.quiz)
      setTimeLeft(data.quiz.time_limit_secs)
      startTimer(data.quiz.time_limit_secs, data.quiz.quiz_id, params.user_id)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const startTimer = (seconds: number, quizId: string, userId: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    let remaining = seconds
    timerRef.current = setInterval(() => {
      remaining -= 1
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        // Auto-submit with current answers
        submitQuiz(quizId, userId, 0)
      }
    }, 1000)
  }

  const answerQuestion = useCallback((questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  const submitQuiz = useCallback(async (
    quizId: string,
    userId: string,
    timeTaken: number,
  ) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSubmitting(true)
    setError(null)
    try {
      const userAnswers = Object.entries(answers).map(([qId, answer]) => ({
        question_id: parseInt(qId),
        answer,
      }))
      const res = await fetch(`${API}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: quizId, user_id: userId,
          user_answers: userAnswers, time_taken: timeTaken,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Failed to submit quiz')
      setResult(data.result)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }, [answers])

  const loadQuizById = useCallback(async (quizId: string, userId: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setAnswers({})

    try {
      const res = await fetch(`${API}/api/quiz/${quizId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to load quiz')

      const normalized = normalizeQuiz(data)
      if (!normalized.quiz_id) throw new Error('Quiz record is missing an id')

      setQuiz(normalized)
      setTimeLeft(normalized.time_limit_secs)

      if (!normalized.completed) {
        startTimer(normalized.time_limit_secs, normalized.quiz_id, userId)
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    quiz, result, loading, submitting, error,
    timeLeft, answers,
    generateQuiz, answerQuestion, submitQuiz, loadQuizById,
  }
}