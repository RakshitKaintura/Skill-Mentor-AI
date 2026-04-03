"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'

const API = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:8000'

type LoadState = 'loading' | 'no-user' | 'no-roadmap' | 'error'

export default function DailyChallengePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('Preparing your daily challenge...')

  useEffect(() => {
    let mounted = true
    const loadTodayChallenge = async () => {
      if (authLoading) return
      if (!user) {
        if (!mounted) return
        setState('no-user')
        return
      }
      try {
        const supabase = createClient()
        const { data: roadmap } = await supabase
          .from('roadmaps')
          .select('id, skill')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!mounted) return
        if (!roadmap?.id || !roadmap?.skill) {
          setState('no-roadmap')
          return
        }
        const challengeRes = await fetch(
          `${API}/api/daily/challenge/${user.id}?roadmap_id=${encodeURIComponent(roadmap.id)}&skill=${encodeURIComponent(roadmap.skill)}`
        )
        if (!challengeRes.ok) {
          throw new Error(`Daily challenge request failed with status ${challengeRes.status}`)
        }
        const payload = await challengeRes.json() as { success?: boolean; challenge?: { challenge_id?: string; id?: string } }
        const challengeId = payload.challenge?.challenge_id ? payload.challenge.challenge_id : payload.challenge?.id
        if (!payload.success || !challengeId) {
          throw new Error('Daily challenge payload is missing challenge id')
        }
        router.replace(`/daily-challenge/${challengeId}`)
      } catch (e) {
        if (!mounted) return
        const text = e instanceof Error ? e.message : 'Unable to load daily challenge right now.'
        setMessage(text)
        setState('error')
      }
    }
    loadTodayChallenge()
    return () => { mounted = false }
  }, [authLoading, user, router])
  if (state === 'loading' ? true : authLoading) {
    return (
      <div className="min-h-screen page-tone-mint flex items-center justify-center">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-sm text-[var(--color-app-text-secondary)]">{message}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen page-tone-mint text-[var(--color-app-text-primary)]">
      <DashboardNavbar />
      <SectionContainer className="py-8">
        <Card className="text-center bg-[var(--color-app-surface-cool)]">
          <h1 className="text-3xl font-semibold mb-2">Daily Challenge</h1>
          <p className="text-sm text-[var(--color-app-text-secondary)] mb-6">Keep your learning streak alive with short focused exercises.</p>
          {state === 'no-user' ? (
            <>
              <p className="text-sm text-[var(--color-app-text-secondary)] mb-4">Please sign in to access your daily challenge.</p>
              <Link href="/auth/login" className="inline-flex items-center justify-center rounded-lg bg-[var(--color-app-primary)] px-6 py-3 text-sm font-medium text-white hover:bg-[#1765cc]">
                Go to Login
              </Link>
            </>
          ) : state === 'no-roadmap' ? (
            <>
              <p className="text-sm text-[var(--color-app-text-secondary)] mb-4">No active roadmap found yet. Create one to unlock daily challenges.</p>
              <Link href="/roadmap" className="inline-flex items-center justify-center rounded-lg bg-[var(--color-app-primary)] px-6 py-3 text-sm font-medium text-white hover:bg-[#1765cc]">
                Create Roadmap
              </Link>
            </>
          ) : state === 'error' ? (
            <>
              <p className="text-sm text-[var(--color-app-text-secondary)] mb-4">{message}</p>
              <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-lavender)] px-6 py-3 text-sm font-medium text-[var(--color-app-text-primary)] hover:bg-[var(--color-app-surface)]">
                Retry
              </button>
            </>
          ) : null}
        </Card>
      </SectionContainer>
    </div>
  )
}
