'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface TrackPayload {
  event_data?: Record<string, unknown>
  page?: string
  session_id?: string
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-session'
  const key = 'sm_session_id'
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  window.sessionStorage.setItem(key, created)
  return created
}

export function useAnalytics() {
  const { user } = useAuth()
  const sessionId = useMemo(() => getSessionId(), [])

  const track = useCallback(async (eventType: string, payload: TrackPayload = {}) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          user_id: user?.id ?? null,
          event_data: payload.event_data ?? {},
          page: payload.page ?? (typeof window !== 'undefined' ? window.location.pathname : null),
          session_id: payload.session_id ?? sessionId,
        }),
      })
    } catch {
      // Analytics must never break UX.
    }
  }, [user, sessionId])

  return { track }
}
