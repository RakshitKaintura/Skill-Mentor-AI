"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { createClient } from '@/lib/supabase/client'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import CodeBlock from '@/components/lesson/CodeBlock'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'

const API = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:8000'

type ChallengeType = 'quiz' | 'code' | 'theory' | 'review'

interface QuizQuestion {
  question: string
  options: string[]
}

interface ChallengeContent {
  questions?: Array<QuizQuestion | string>
  task_description?: string
  hint?: string
  starter_code?: string
  explain_prompt?: string
  topics_to_review?: string[]
}

interface DailyChallengeDetail {
  id?: string
  challenge_id: string
  title: string
  description: string
  type: ChallengeType
  content?: ChallengeContent
}

export default function DailyChallengeDetailPage() {
  const params = useParams<{ id?: string | string[] }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { track } = useAnalytics()

  const [challenge, setChallenge] = useState<DailyChallengeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [codeInput, setCodeInput] = useState('')
  const [theoryInput, setTheoryInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!challenge || !user) return
    const challengeId = challenge.challenge_id || challenge.id
    if (!challengeId) return

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/daily/challenge/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, user_id: user.id }),
      })

      if (!res.ok) {
        throw new Error(`Submit failed (${res.status})`)
      }

      const data = await res.json()
      if (data.success || data.already_completed) {
        setXpEarned(data.xp_awarded ? data.xp_awarded : 0)
        setSubmitted(true)
        void track('daily_challenge_completed', {
          event_data: {
            challenge_id: challengeId,
            challenge_type: challenge.type,
            xp_awarded: data.xp_awarded ? data.xp_awarded : 0,
            already_completed: Boolean(data.already_completed),
          },
          page: '/daily-challenge',
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit challenge.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadChallenge = async () => {
      if (authLoading) return
      if (!user) {
        if (mounted) {
          setError('Please login to access daily challenge.')
          setLoading(false)
        }
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

        if (!roadmap?.id || !roadmap?.skill) {
          throw new Error('No roadmap found. Create a roadmap first.')
        }

        const res = await fetch(
          `${API}/api/daily/challenge/${user.id}?roadmap_id=${encodeURIComponent(roadmap.id)}&skill=${encodeURIComponent(roadmap.skill)}`
        )

        if (!res.ok) {
          throw new Error(`Failed to load daily challenge (${res.status})`)
        }

        const payload = await res.json() as { success?: boolean; challenge?: DailyChallengeDetail }
        const row = payload.challenge
        const challengeId = row && row.challenge_id ? row.challenge_id : row && row.id ? row.id : null

        if (!payload.success || !row || !challengeId) {
          throw new Error('Daily challenge is unavailable right now.')
        }

        const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id
        if (routeId && routeId !== challengeId) {
          router.replace(`/daily-challenge/${challengeId}`)
          return
        }

        if (mounted) {
          setChallenge({ ...row, challenge_id: challengeId })
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load daily challenge.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadChallenge()
    return () => { mounted = false }
  }, [authLoading, user, params, router])

  const content: ChallengeContent = challenge ? challenge.content || {} : {}
  const quizQuestions = (content.questions ? content.questions : []).filter((q): q is QuizQuestion => typeof q === 'object' && q !== null && 'question' in q && Array.isArray((q as QuizQuestion).options))
  const reviewQuestions = (content.questions ? content.questions : []).filter((q): q is string => typeof q === 'string')

  if (loading) return <div className="min-h-screen page-tone-mint flex items-center justify-center"><Spinner /></div>
  if (!challenge) return <div className="min-h-screen page-tone-mint flex items-center justify-center text-[var(--color-app-text-secondary)]">{error ? error : 'Challenge not found.'}</div>

  return (
    <div className="min-h-screen page-tone-mint text-[var(--color-app-text-primary)]">
      <DashboardNavbar />
      <SectionContainer className="py-8">
        <button onClick={() => router.push('/dashboard')} className="mb-4 text-sm font-medium text-[var(--color-app-text-secondary)] hover:text-[var(--color-app-text-primary)]">← Back to Dashboard</button>
        <Card className="bg-[var(--color-app-surface-cool)]">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold">{challenge.title}</h1>
            <p className="text-sm text-[var(--color-app-text-secondary)]">{challenge.description}</p>

            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="text-5xl">🎯</div>
                <div className="text-2xl font-semibold text-[var(--color-app-primary)]">Complete!</div>
                <p className="text-sm text-[var(--color-app-text-secondary)]">You earned <span className="font-semibold text-[#4FFFA0]">+{xpEarned} XP</span></p>
                <button onClick={() => router.push('/dashboard')} className="inline-flex items-center justify-center rounded-lg bg-[var(--color-app-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1765cc]">Back to Dashboard →</button>
              </div>
            ) : (
              <div className="space-y-6">
                {challenge.type === 'quiz' && quizQuestions.length > 0 && (
                  <div className="space-y-4">
                    {quizQuestions.map((q, qi) => (
                      <Card key={qi} className="bg-[var(--color-app-surface-lavender)]">
                        <p className="font-medium">{q.question}</p>
                        <div className="space-y-2 mt-3">
                          {q.options.map((opt, oi) => (
                            <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [qi]: opt }))} className={`w-full rounded-lg border px-3 py-2 text-left ${answers[qi] === opt ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary)]/10' : 'border-[var(--color-app-border)] hover:border-[var(--color-app-primary)]'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </Card>
                    ))}
                    <button onClick={handleSubmit} disabled={submitting ? true : Object.keys(answers).length < quizQuestions.length} className="w-full rounded-lg bg-[var(--color-app-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Quiz'}</button>
                  </div>
                )}
                {challenge.type === 'code' && (
                  <Card className="bg-[var(--color-app-surface-mint)]">
                    <p className="text-xs uppercase tracking-widest text-[var(--color-app-text-secondary)] mb-2">Task</p>
                    <p className="text-sm mb-3">{content.task_description}</p>
                    {content.hint ? <p className="text-xs text-[#FFD166] mb-3">💡 Hint: {content.hint}</p> : null}
                    {content.starter_code ? <CodeBlock code={content.starter_code} language="javascript" /> : null}
                    <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} rows={10} placeholder="Write your solution here..." className="w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-bg)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]" />
                    <button onClick={handleSubmit} disabled={submitting ? true : !codeInput.trim()} className="w-full mt-3 rounded-lg bg-[var(--color-app-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Solution'}</button>
                  </Card>
                )}
                {challenge.type === 'theory' && (
                  <Card className="bg-[var(--color-app-surface-warm)]">
                    <p className="text-xs uppercase tracking-widest text-[var(--color-app-text-secondary)] mb-2">Explain</p>
                    <p className="text-sm mb-3">{content.explain_prompt}</p>
                    <textarea value={theoryInput} onChange={(e) => setTheoryInput(e.target.value)} rows={6} placeholder="Type your explanation here..." className="w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-bg)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]" />
                    <button onClick={handleSubmit} disabled={submitting ? true : !theoryInput.trim()} className="w-full mt-3 rounded-lg bg-[var(--color-app-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Explanation'}</button>
                  </Card>
                )}
                {challenge.type === 'review' && (
                  <Card className="bg-[var(--color-app-surface-cool)]">
                    <p className="text-xs uppercase tracking-widest text-[var(--color-app-text-secondary)] mb-2">Topics to Review</p>
                    <div className="flex flex-wrap gap-2 mb-4">{(content.topics_to_review ? content.topics_to_review : []).map((t, i) => <span key={i} className="rounded-lg border border-[#4FFFA0]/40 bg-[#4FFFA0]/10 px-2 py-1 text-xs text-[#4FFFA0]">{t}</span>)}</div>
                    {reviewQuestions.map((q, qi) => (
                      <div key={qi} className="mb-3">
                        <p className="text-sm mb-2">{q}</p>
                        <textarea value={answers[qi] ? answers[qi] : ''} onChange={(e) => setAnswers((a) => ({ ...a, [qi]: e.target.value }))} rows={3} className="w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-bg)] p-2 text-sm" />
                      </div>
                    ))}
                    <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-lg bg-[var(--color-app-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50">{submitting ? 'Submitting…' : 'Complete Review'}</button>
                  </Card>
                )}
              </div>
            )}
          </div>
        </Card>
      </SectionContainer>
    </div>
  )
}
