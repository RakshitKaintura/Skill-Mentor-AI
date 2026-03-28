'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

        const payload = await challengeRes.json() as {
          success?: boolean
          challenge?: { challenge_id?: string; id?: string }
        }

        const challengeId = payload.challenge?.challenge_id || payload.challenge?.id
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

    return () => {
      mounted = false
    }
  }, [authLoading, user, router])

  if (state === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-brand-muted font-mono text-sm">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <h1 className="font-display font-black text-3xl text-brand-text mb-3">Daily Challenge</h1>

          {state === 'no-user' && (
            <>
              <p className="text-brand-muted font-mono text-sm mb-6">
                Please sign in to access your daily challenge.
              </p>
              <Link
                href="/auth/login"
                className="inline-block bg-brand-green text-brand-bg px-6 py-3 rounded-lg font-mono font-bold text-sm hover:bg-brand-green/90"
              >
                Go to Login
              </Link>
            </>
          )}

          {state === 'no-roadmap' && (
            <>
              <p className="text-brand-muted font-mono text-sm mb-6">
                No active roadmap found yet. Create one to unlock daily challenges.
              </p>
              <Link
                href="/roadmap"
                className="inline-block bg-brand-green text-brand-bg px-6 py-3 rounded-lg font-mono font-bold text-sm hover:bg-brand-green/90"
              >
                Create Roadmap
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="text-brand-muted font-mono text-sm mb-6">{message}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-block bg-brand-green text-brand-bg px-6 py-3 rounded-lg font-mono font-bold text-sm hover:bg-brand-green/90"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
