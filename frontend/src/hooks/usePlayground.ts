'use client'
import { useState, useCallback } from 'react'
import type { CodeChallenge, EvaluationResult } from '@/types/week3'
import { PlaygroundService } from '@/services/playground.service'

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
    const cacheKey = `playground_v3_${params.lesson_id}_${params.topic}_${params.difficulty}_${params.language}`
    
    // 1. Try to load from session storage
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        setChallenge(data.challenge)
        setCode(data.challenge.starter_code)
        return
      }
    } catch (e) {
      // Ignore cache errors
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setHint(null)
    setHintsUsed(0)
    try {
      const data = await PlaygroundService.generateChallenge(params)
      if (!data.success) throw new Error(data.detail || 'Failed to generate challenge')
      
      // Save to session storage
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
      } catch (e) {}

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
      const data = await PlaygroundService.requestHint({
          challenge_id: challenge.challenge_id,
          user_id: userId,
          user_code: code,
          hint_level: nextLevel,
      })
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
      const data = await PlaygroundService.evaluateCode({
          challenge_id: challenge.challenge_id,
          user_id: userId,
          user_code: code,
          hints_used: hintsUsed,
      })
      if (data.success) setResult(data.result)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setEvaluating(false)
    }
  }, [challenge, code, hintsUsed])

  const explainError = useCallback(async (errorMsg: string, language: string, topic: string) => {
    try {
      const data = await PlaygroundService.explainError({
          error_message: errorMsg, code, language, topic,
      })
      if (data.success) setErrorExplain(data.explanation)
    } catch { /* silent */ }
  }, [code])

  return {
    challenge, code, setCode, result, hint, errorExplain,
    loading, evaluating, gettingHint, hintsUsed, error,
    generateChallenge, requestHint, evaluateCode, explainError,
  }
}