'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { createClient } from '@/lib/supabase/client'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import CodeBlock from '@/components/lesson/CodeBlock'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
  const router   = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { track } = useAnalytics()

  const [challenge, setChallenge]  = useState<DailyChallengeDetail | null>(null)
  const [loading,   setLoading]    = useState(true)
  const [error, setError]          = useState<string | null>(null)
  const [answers,   setAnswers]    = useState<Record<number, string>>({})
  const [codeInput, setCodeInput]  = useState('')
  const [theoryInput, setTheoryInput] = useState('')
  const [submitted, setSubmitted]  = useState(false)
  const [xpEarned,  setXpEarned]   = useState(0)
  const [submitting, setSubmitting] = useState(false)

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

        const payload = await res.json() as {
          success?: boolean
          challenge?: DailyChallengeDetail
        }
        const row = payload.challenge
        const challengeId = row?.challenge_id || row?.id

        if (!payload.success || !row || !challengeId) {
          throw new Error('Daily challenge is unavailable right now.')
        }

        // Keep route and data in sync if server returned a different id.
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

    return () => {
      mounted = false
    }
  }, [authLoading, user, params, router])

  const handleSubmit = async () => {
    if (!challenge || !user) return
    const challengeId = challenge.challenge_id || challenge.id
    if (!challengeId) return

    setSubmitting(true)
    try {
      const res  = await fetch(`${API}/api/daily/challenge/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, user_id: user.id }),
      })

      if (!res.ok) {
        throw new Error(`Submit failed (${res.status})`)
      }

      const data = await res.json()
      if (data.success || data.already_completed) {
        setXpEarned(data.xp_awarded || 0)
        setSubmitted(true)
        void track('daily_challenge_completed', {
          event_data: {
            challenge_id: challengeId,
            challenge_type: challenge.type,
            xp_awarded: data.xp_awarded || 0,
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

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center"><Spinner /></div>
  )
  if (!challenge) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-muted font-mono text-sm">{error || 'Challenge not found.'}</p>
    </div>
  )

  const content: ChallengeContent = challenge.content || {}
  const quizQuestions = (content.questions || []).filter(
    (q): q is QuizQuestion => typeof q === 'object' && q !== null && 'question' in q && Array.isArray((q as QuizQuestion).options)
  )
  const reviewQuestions = (content.questions || []).filter((q): q is string => typeof q === 'string')

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-brand-muted font-mono text-xs hover:text-brand-text mb-4 block">
            ← Back to Dashboard
          </button>
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-1">Daily Challenge</div>
          <h1 className="font-display font-black text-3xl text-brand-text">{challenge.title}</h1>
          <p className="text-brand-muted font-mono text-sm mt-2">{challenge.description}</p>
        </div>

        {submitted ? (
          <div className="bg-brand-surface border border-brand-green/30 rounded-xl p-8 text-center">
            <div className="text-5xl mb-3">🎯</div>
            <div className="font-display font-black text-3xl text-brand-green mb-2">Complete!</div>
            <div className="text-brand-muted font-mono text-sm mb-4">
              You earned <span className="text-brand-yellow font-bold">+{xpEarned} XP</span>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-brand-green text-brand-bg px-6 py-3 rounded-lg font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors"
            >
              Back to Dashboard →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* QUIZ type */}
            {challenge.type === 'quiz' && quizQuestions.length > 0 && (
              <div className="space-y-5">
                {quizQuestions.map((q: QuizQuestion, qi: number) => (
                  <div key={qi} className="bg-brand-surface border border-brand-border rounded-xl p-5">
                    <p className="text-brand-text font-mono text-sm mb-4">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt: string, oi: number) => (
                        <button
                          key={oi}
                          onClick={() => setAnswers(a => ({ ...a, [qi]: opt }))}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border font-mono text-sm transition-all ${
                            answers[qi] === opt
                              ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                              : 'border-brand-border text-brand-text hover:border-brand-blue/40'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || Object.keys(answers).length < quizQuestions.length}
                  className="w-full bg-brand-green text-brand-bg py-3 rounded-xl font-mono font-bold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : 'Submit Quiz'}
                </button>
              </div>
            )}

            {/* CODE type */}
            {challenge.type === 'code' && (
              <div className="space-y-4">
                <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                  <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Task</div>
                  <p className="text-brand-text text-sm leading-relaxed">{content.task_description}</p>
                  {content.hint && (
                    <div className="mt-3 text-brand-yellow font-mono text-xs">💡 Hint: {content.hint}</div>
                  )}
                </div>
                {content.starter_code && (
                  <div>
                    <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Starter Code</div>
                    <CodeBlock code={content.starter_code} language="javascript" />
                  </div>
                )}
                <textarea
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value)}
                  placeholder="Write your solution here..."
                  rows={10}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-green/50 resize-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !codeInput.trim()}
                  className="w-full bg-brand-green text-brand-bg py-3 rounded-xl font-mono font-bold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : 'Submit Solution'}
                </button>
              </div>
            )}

            {/* THEORY type */}
            {challenge.type === 'theory' && (
              <div className="space-y-4">
                <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                  <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Explain in your own words</div>
                  <p className="text-brand-text text-sm leading-relaxed">{content.explain_prompt}</p>
                </div>
                <textarea
                  value={theoryInput}
                  onChange={e => setTheoryInput(e.target.value)}
                  placeholder="Type your explanation here..."
                  rows={6}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-purple/50 resize-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !theoryInput.trim()}
                  className="w-full bg-brand-green text-brand-bg py-3 rounded-xl font-mono font-bold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : 'Submit Explanation'}
                </button>
              </div>
            )}

            {/* REVIEW type */}
            {challenge.type === 'review' && (
              <div className="space-y-4">
                <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                  <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Topics to Review</div>
                  <div className="flex flex-wrap gap-2">
                    {(content.topics_to_review || []).map((t: string, i: number) => (
                      <span key={i} className="text-xs font-mono bg-brand-green/10 border border-brand-green/30 text-brand-green px-2 py-1 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                {reviewQuestions.map((q: string, qi: number) => (
                  <div key={qi} className="bg-brand-surface border border-brand-border rounded-xl p-4">
                    <p className="text-brand-text font-mono text-sm mb-3">{q}</p>
                    <textarea
                      value={answers[qi] || ''}
                      onChange={e => setAnswers(a => ({ ...a, [qi]: e.target.value }))}
                      placeholder="Your answer..."
                      rows={3}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text font-mono text-sm focus:outline-none resize-none"
                    />
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-brand-green text-brand-bg py-3 rounded-xl font-mono font-bold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : 'Complete Review'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}