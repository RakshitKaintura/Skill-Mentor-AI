'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AnalyticsService } from '@/services/analytics.service'

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
      await AnalyticsService.trackEvent({
        event_type: eventType,
        user_id: user?.id ?? undefined,
        event_data: payload.event_data ?? {},
        page: payload.page ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
        session_id: payload.session_id ?? sessionId,
      })
    } catch {
      // Analytics must never break UX.
    }
  }, [user, sessionId])

  return { track }
}
