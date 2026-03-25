'use client'
import { useState, useCallback } from 'react'
import type { CodeChallenge, EvaluationResult } from '@/types/week3'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function usePlayground() {
  const [challenge, setChallenge]     = useState<CodeChallenge | null>(null)
  const [code, setCode]               = useState('')
  const [result, setResult]           = useState<EvaluationResult | null>(null)
  const [hint, setHint]               = useState<{ hint: string; hint_level: number; encouragement: string } | null>(null)
  const [errorExplain, setErrorExplain] = useState<unknown>(null)
  const [loading, setLoading]         = useState(false)
  const [evaluating, setEvaluating]   = useState(false)
  const [gettingHint, setGettingHint] = useState(false)
  const [hintsUsed, setHintsUsed]     = useState(0)
  const [error, setError]             = useState<string | null>(null)

  const getErrorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Unexpected error')

  const generateChallenge = useCallback(async (params: {
    user_id: string
    roadmap_id: string
    lesson_id: string
    topic: string
    skill: string
    difficulty?: string
    language?: string
  }) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setHint(null)
    setHintsUsed(0)
    try {
      const res = await fetch(`${API}/api/playground/challenge/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Failed to generate challenge')
      setChallenge(data.challenge)
      setCode(data.challenge.starter_code)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const requestHint = useCallback(async (userId: string) => {
    if (!challenge) return
    const nextLevel = hintsUsed + 1
    if (nextLevel > 3) return
    setGettingHint(true)
    try {
      const res = await fetch(`${API}/api/playground/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          user_id: userId,
          user_code: code,
          hint_level: nextLevel,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setHint(data.hint)
        setHintsUsed(nextLevel)
      }
    } finally {
      setGettingHint(false)
    }
  }, [challenge, code, hintsUsed])

  const evaluateCode = useCallback(async (userId: string) => {
    if (!challenge) return
    setEvaluating(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/playground/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          user_id: userId,
          user_code: code,
          hints_used: hintsUsed,
        }),
      })
      const data = await res.json()
      if (data.success) setResult(data.result)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setEvaluating(false)
    }
  }, [challenge, code, hintsUsed])

  const explainError = useCallback(async (errorMsg: string, language: string, topic: string) => {
    try {
      const res = await fetch(`${API}/api/playground/explain-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: errorMsg, code, language, topic,
        }),
      })
      const data = await res.json()
      if (data.success) setErrorExplain(data.explanation)
    } catch { /* silent */ }
  }, [code])

  return {
    challenge, code, setCode, result, hint, errorExplain,
    loading, evaluating, gettingHint, hintsUsed, error,
    generateChallenge, requestHint, evaluateCode, explainError,
  }
}