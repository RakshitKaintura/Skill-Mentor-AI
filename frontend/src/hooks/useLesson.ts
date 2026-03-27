'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface LessonStep {
  type:         'intro' | 'analogy' | 'code_demo' | 'try_it' | 'mistakes' | 'summary'
  title:        string
  content:      string
  code_snippet: string | null
  language:     string | null
}

export interface Lesson {
  id:             string
  topic:          string
  skill?:         string
  week_number:    number
  steps:          LessonStep[]
  sources_used:   string[]
  key_takeaway?:  string
  next_topic?:    string
  completed:      boolean
  pdf_notes_url?: string
}

export interface GenerateLessonParams {
  roadmap_id:  string
  topic:       string
  skill:       string
  level:       string
  phase_name:  string
  week_number: number
}

export function useLesson() {
  const supabase = createClient()
  const [lesson, setLesson]         = useState<Lesson | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchLesson = useCallback(async (lessonId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lesson/${lessonId}`)
      if (!res.ok) throw new Error('Lesson not found')
      const data = await res.json()
      setLesson(data)
      return data as Lesson
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load lesson')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const generateLesson = useCallback(async (params: GenerateLessonParams) => {
    setGenerating(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lesson/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...params }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to generate lesson' }))
        throw new Error(err.detail)
      }

      const data = await res.json()
      await fetchLesson(data.lesson_id)
      return data.lesson_id as string
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate lesson')
      return null
    } finally {
      setGenerating(false)
    }
  }, [supabase, fetchLesson])

  const completeLesson = useCallback(async (lessonId: string, timeSpentMinutes: number = 0) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lesson/${lessonId}/complete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, lesson_id: lessonId, time_spent_minutes: timeSpentMinutes }),
    })
    setLesson(prev => prev ? { ...prev, completed: true } : null)
  }, [supabase])

  const generateNotes = useCallback(async (lessonId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/lesson/${lessonId}/notes?user_id=${user.id}`,
      { method: 'POST' }
    )
    if (!res.ok) return null
    const data = await res.json()
    setLesson(prev => prev ? { ...prev, pdf_notes_url: data.pdf_url } : null)
    return data.pdf_url as string
  }, [supabase])

  return { lesson, loading, error, generating, generateLesson, fetchLesson, completeLesson, generateNotes }
}