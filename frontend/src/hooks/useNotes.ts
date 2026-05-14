'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────

export interface Note {
  id:          string
  lesson_id:   string | null
  roadmap_id:  string | null
  skill:       string
  topic:       string
  step_index:  number | null
  step_title:  string | null
  content:     string
  ai_summary:  string | null
  tags:        string[]
  created_at:  string
  updated_at:  string
}

interface NoteCreateData {
  lesson_id?:  string | null
  roadmap_id?: string | null
  skill:       string
  topic:       string
  step_index?: number | null
  step_title?: string | null
  content:     string
  tags?:       string[]
}

interface UseNotesOptions {
  lessonId?: string   // pre-filter: only fetch notes for this lesson
}

interface UseNotesReturn {
  notes:       Note[]
  loading:     boolean
  saving:      boolean
  summarizing: boolean
  fetchNotes:  (opts?: { lessonId?: string; skill?: string; search?: string }) => Promise<void>
  create:      (data: NoteCreateData) => Promise<Note | null>
  update:      (id: string, data: { content?: string; tags?: string[] }) => Promise<void>
  remove:      (id: string) => Promise<void>
  summarize:   (noteIds: string[]) => Promise<string | null>
  exportMd:    (noteIds?: string[]) => string
}

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

// ── Hook ─────────────────────────────────────────────────────

export function useNotes(_opts?: UseNotesOptions): UseNotesReturn {
  const supabase = createClient()
  const [notes,       setNotes]       = useState<Note[]>([])
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const userIdRef = useRef<string | null>(null)

  // ── Get current user_id (memoized) ──────────────────────────

  const getUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current
    const { data: { user } } = await supabase.auth.getUser()
    userIdRef.current = user?.id ?? null
    return userIdRef.current
  }, [supabase])

  // ── Fetch notes ──────────────────────────────────────────────

  const fetchNotes = useCallback(async (opts?: {
    lessonId?: string; skill?: string; search?: string
  }) => {
    const userId = await getUserId()
    if (!userId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ user_id: userId })
      if (opts?.lessonId) params.set('lesson_id', opts.lessonId)
      if (opts?.skill)    params.set('skill',     opts.skill)
      if (opts?.search)   params.set('search',    opts.search)

      const res = await fetch(`${API}/api/notes?${params}`)
      if (!res.ok) throw new Error('Failed to fetch notes')
      const data = await res.json()
      setNotes(data.notes ?? [])
    } catch (e) {
      console.error('useNotes fetchNotes:', e)
    } finally {
      setLoading(false)
    }
  }, [getUserId])

  // ── Create note (optimistic) ──────────────────────────────────

  const create = useCallback(async (data: NoteCreateData): Promise<Note | null> => {
    const userId = await getUserId()
    if (!userId) return null
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, ...data }),
      })
      if (!res.ok) throw new Error('Failed to create note')
      const note: Note = await res.json()
      // Optimistic prepend
      setNotes(prev => [note, ...prev])
      return note
    } catch (e) {
      console.error('useNotes create:', e)
      return null
    } finally {
      setSaving(false)
    }
  }, [getUserId])

  // ── Update note (optimistic) ──────────────────────────────────

  const update = useCallback(async (
    id: string,
    data: { content?: string; tags?: string[] }
  ) => {
    const userId = await getUserId()
    if (!userId) return
    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n
    ))
    try {
      const res = await fetch(`${API}/api/notes/${id}?user_id=${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update note')
      const updated: Note = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
    } catch (e) {
      console.error('useNotes update:', e)
    }
  }, [getUserId])

  // ── Delete note (optimistic) ──────────────────────────────────

  const remove = useCallback(async (id: string) => {
    const userId = await getUserId()
    if (!userId) return
    // Optimistic remove
    setNotes(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`${API}/api/notes/${id}?user_id=${userId}`, { method: 'DELETE' })
    } catch (e) {
      console.error('useNotes remove:', e)
    }
  }, [getUserId])

  // ── Summarize notes ───────────────────────────────────────────

  const summarize = useCallback(async (noteIds: string[]): Promise<string | null> => {
    const userId = await getUserId()
    if (!userId || noteIds.length === 0) return null
    setSummarizing(true)
    try {
      const res = await fetch(`${API}/api/notes/summarize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, note_ids: noteIds }),
      })
      if (!res.ok) throw new Error('Summarization failed')
      const data = await res.json()
      // Update local ai_summary for each summarized note
      setNotes(prev => prev.map(n =>
        noteIds.includes(n.id) ? { ...n, ai_summary: data.summary } : n
      ))
      return data.summary as string
    } catch (e) {
      console.error('useNotes summarize:', e)
      return null
    } finally {
      setSummarizing(false)
    }
  }, [getUserId])

  // ── Export to Markdown (client-side, no API) ──────────────────

  const exportMd = useCallback((noteIds?: string[]): string => {
    const target = noteIds
      ? notes.filter(n => noteIds.includes(n.id))
      : notes

    if (target.length === 0) return ''

    const { skill, topic } = target[0]
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const lines: string[] = [
      `# Notes: ${topic} — ${skill}`,
      `> Exported from Skill Mentor AI on ${date}`,
      '',
    ]

    // Group by step
    const byStep: Record<string, Note[]> = {}
    for (const n of target) {
      const key = n.step_title ?? 'General'
      ;(byStep[key] ??= []).push(n)
    }

    for (const [stepTitle, stepNotes] of Object.entries(byStep)) {
      lines.push(`## ${stepTitle}`)
      for (const n of stepNotes) {
        lines.push('', n.content)
        if (n.ai_summary) {
          lines.push('', '**AI Summary:**', n.ai_summary)
        }
        if (n.tags.length > 0) {
          lines.push('', `Tags: ${n.tags.map(t => `\`${t}\``).join(', ')}`)
        }
        lines.push('', '---')
      }
    }

    return lines.join('\n')
  }, [notes])

  return {
    notes, loading, saving, summarizing,
    fetchNotes, create, update, remove, summarize, exportMd,
  }
}
