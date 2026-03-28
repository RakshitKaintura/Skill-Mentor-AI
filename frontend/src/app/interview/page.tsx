'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import type {
  InterviewSession, AnswerEvaluation, InterviewSummary
} from '@/types/week4'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function InterviewPageContent() {
  const params   = useSearchParams()
  const router   = useRouter()
  const { user } = useAuth()
  const { track } = useAnalytics()

  const [session,      setSession]      = useState<InterviewSession | null>(null)
  const [summary,      setSummary]      = useState<InterviewSummary | null>(null)
  const [currentQ,     setCurrentQ]     = useState(0)
  const [answer,       setAnswer]       = useState('')
  const [evaluations,  setEvaluations]  = useState<AnswerEvaluation[]>([])
  const [allAnswers,   setAllAnswers]   = useState<Array<{ question_id: number; answer: string }>>([])
  const [currentEval,  setCurrentEval]  = useState<AnswerEvaluation | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [evaluating,   setEvaluating]   = useState(false)
  const [finishing,    setFinishing]    = useState(false)
  const [phase,        setPhase]        = useState<'setup' | 'interview' | 'results'>('setup')

  // Setup form state
  const [interviewType,   setInterviewType]   = useState('technical')
  const [companyTarget,   setCompanyTarget]   = useState('')
  const [numQuestions,    setNumQuestions]    = useState(6)

  const skill     = params.get('skill')      || ''
  const level     = params.get('level')      || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const startInterview = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, roadmap_id: roadmapId,
          skill, level, interview_type: interviewType,
          company_target: companyTarget, num_questions: numQuestions,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSession(data.interview)
        setPhase('interview')
      }
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async () => {
    if (!session || !answer.trim()) return
    const q = session.questions[currentQ]
    setEvaluating(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/evaluate-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          question_id: q.id, question_text: q.question,
          answer, key_points: q.key_points,
          skill, level,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const evaluation = data.evaluation
        setCurrentEval(evaluation)
        setEvaluations(prev => [...prev, evaluation])
        setAllAnswers(prev => [...prev, { question_id: q.id, answer }])
      }
    } finally {
      setEvaluating(false)
    }
  }

  const nextQuestion = () => {
    setCurrentEval(null)
    setAnswer('')
    if (currentQ + 1 >= (session?.questions.length || 0)) {
      finishInterview()
    } else {
      setCurrentQ(prev => prev + 1)
    }
  }

  const finishInterview = async () => {
    if (!session || !user) return
    setFinishing(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id, user_id: user.id,
          answers: allAnswers, evaluations,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
        setPhase('results')
        void track('interview_completed', {
          page: '/interview',
          event_data: {
            session_id: session.session_id,
            skill,
            level,
            interview_type: interviewType,
            questions_count: session.questions.length,
            overall_score: data.summary?.overall_score,
            xp_awarded: data.summary?.xp_awarded,
            job_ready: data.summary?.job_ready,
          },
        })
      }
    } finally {
      setFinishing(false)
    }
  }

  const verdictColor = (v: string) => {
    if (v === 'Excellent')   return 'text-brand-green border-brand-green/40 bg-brand-green/10'
    if (v === 'Good')        return 'text-brand-blue  border-brand-blue/40  bg-brand-blue/10'
    if (v === 'Needs Work')  return 'text-brand-yellow border-brand-yellow/40 bg-brand-yellow/10'
    return 'text-brand-red border-brand-red/40 bg-brand-red/10'
  }

  const q = session?.questions[currentQ]

  // ── Setup ─────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">Agent 8 · Career Prep</div>
          <h1 className="font-display font-black text-4xl text-brand-text">Mock Interview</h1>
          <p className="text-brand-muted font-mono text-sm mt-2">
            {skill} · {level} level
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">Interview Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['technical', 'behavioral', 'mixed', 'system_design'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setInterviewType(t)}
                  className={`py-3 rounded-lg border font-mono text-sm transition-colors ${
                    interviewType === t
                      ? 'border-brand-green bg-brand-green/10 text-brand-green'
                      : 'border-brand-border text-brand-muted hover:border-brand-green/40'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">
              Target Company (optional)
            </label>
            <input
              type="text"
              value={companyTarget}
              onChange={e => setCompanyTarget(e.target.value)}
              placeholder="e.g. Google, Amazon, startup"
              className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-yellow/50"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">
              Number of Questions: {numQuestions}
            </label>
            <input
              type="range" min={4} max={12} value={numQuestions}
              onChange={e => setNumQuestions(parseInt(e.target.value))}
              className="w-full accent-brand-yellow"
            />
            <div className="flex justify-between text-xs font-mono text-brand-muted mt-1">
              <span>4 (quick)</span><span>12 (thorough)</span>
            </div>
          </div>

          <button
            onClick={startInterview}
            disabled={loading}
            className="w-full bg-brand-yellow text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-yellow/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating questions…' : '🎤 Start Interview'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Interview ─────────────────────────────────────────
  if (phase === 'interview' && session) return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />

      {/* Progress bar */}
      <div className="h-1 bg-brand-border">
        <div
          className="h-1 bg-brand-yellow transition-all duration-500"
          style={{ width: `${((currentQ + (currentEval ? 1 : 0)) / session.questions.length) * 100}%` }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Question header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs font-mono text-brand-muted uppercase tracking-widest">
              Question {currentQ + 1} of {session.questions.length}
            </div>
            {q && (
              <div className="text-xs font-mono text-brand-yellow mt-1">
                {q.type} · {q.difficulty} · ~{q.expected_duration_mins} min
              </div>
            )}
          </div>
          <div className="text-brand-muted font-mono text-xs">
            {evaluations.length} answered
          </div>
        </div>

        {q && !currentEval && (
          <div className="space-y-6">
            {/* Question */}
            <div className="bg-brand-surface border border-brand-yellow/20 rounded-xl p-6">
              <p className="text-brand-text text-base leading-relaxed">{q.question}</p>
              {q.follow_up && (
                <p className="text-brand-muted text-sm mt-3 italic">Follow-up: {q.follow_up}</p>
              )}
            </div>

            {/* Key points hint */}
            <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Key areas to cover</div>
              <ul className="space-y-1">
                {q.key_points.map((kp, i) => (
                  <li key={i} className="text-brand-muted text-xs flex gap-2">
                    <span className="text-brand-border">→</span> {kp}
                  </li>
                ))}
              </ul>
            </div>

            {/* Answer input */}
            <div>
              <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">
                Your Answer
              </label>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={8}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-5 py-4 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-yellow/50 resize-none"
              />
            </div>

            <button
              onClick={submitAnswer}
              disabled={evaluating || !answer.trim()}
              className="w-full bg-brand-yellow text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-yellow/90 transition-colors disabled:opacity-40"
            >
              {evaluating ? 'AI is evaluating…' : 'Submit Answer →'}
            </button>
          </div>
        )}

        {/* Evaluation feedback */}
        {currentEval && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-display font-black ${
                currentEval.score >= 80 ? 'text-brand-green' :
                currentEval.score >= 60 ? 'text-brand-yellow' : 'text-brand-red'
              }`}>
                {currentEval.score}/100
              </div>
              <span className={`text-sm font-mono px-3 py-1 rounded border ${verdictColor(currentEval.verdict)}`}>
                {currentEval.verdict}
              </span>
            </div>

            {currentEval.what_was_good && (
              <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-4">
                <div className="text-brand-green text-xs font-mono uppercase tracking-widest mb-2">What was good</div>
                <p className="text-brand-text text-sm leading-relaxed">{currentEval.what_was_good}</p>
              </div>
            )}

            {currentEval.what_was_missing && (
              <div className="bg-brand-yellow/5 border border-brand-yellow/20 rounded-xl p-4">
                <div className="text-brand-yellow text-xs font-mono uppercase tracking-widest mb-2">What was missing</div>
                <p className="text-brand-text text-sm leading-relaxed">{currentEval.what_was_missing}</p>
              </div>
            )}

            <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <div className="text-brand-muted text-xs font-mono uppercase tracking-widest mb-2">Strong answer would include</div>
              <p className="text-brand-text text-sm leading-relaxed">{currentEval.ideal_answer_summary}</p>
            </div>

            <button
              onClick={nextQuestion}
              disabled={finishing}
              className="w-full bg-brand-yellow text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-yellow/90 transition-colors disabled:opacity-40"
            >
              {finishing ? 'Finalizing…' :
                currentQ + 1 >= session.questions.length
                  ? '✓ Finish Interview'
                  : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── Results ───────────────────────────────────────────
  if (phase === 'results' && summary) return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className={`text-8xl font-display font-black mb-2 ${
            summary.overall_score >= 75 ? 'text-brand-green' :
            summary.overall_score >= 55 ? 'text-brand-yellow' : 'text-brand-red'
          }`}>
            {summary.overall_score}%
          </div>
          <div className={`inline-block px-4 py-1 rounded border text-sm font-mono mt-2 ${
            summary.job_ready
              ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
              : 'border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow'
          }`}>
            {summary.job_ready ? '✓ Job Ready!' : 'Keep Practising'} · +{summary.xp_awarded} XP
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
            <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">Overall Feedback</div>
            <p className="text-brand-text text-sm leading-relaxed">{summary.overall_feedback}</p>
          </div>

          <div className="bg-brand-surface border border-brand-green/20 rounded-xl p-6">
            <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-3">Strengths</div>
            <ul className="space-y-2">
              {summary.strengths.map((s, i) => (
                <li key={i} className="text-brand-text text-sm flex gap-2">
                  <span className="text-brand-green">→</span> {s}
                </li>
              ))}
            </ul>
          </div>

          {summary.improvements.length > 0 && (
            <div className="bg-brand-surface border border-brand-yellow/20 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-3">Areas to Improve</div>
              <div className="space-y-3">
                {summary.improvements.map((item, i) => (
                  <div key={i} className="border border-brand-border rounded-lg p-3">
                    <div className="text-brand-text text-sm font-medium">{item.area}</div>
                    <div className="text-brand-yellow text-xs mt-1">Action: {item.action}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-brand-surface border border-brand-blue/20 rounded-xl p-6">
            <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">Study Plan</div>
            <ol className="space-y-2">
              {summary.study_plan.map((s, i) => (
                <li key={i} className="text-brand-text text-sm flex gap-3">
                  <span className="text-brand-blue font-mono flex-shrink-0">{i + 1}.</span> {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="text-center py-4">
            <p className="text-brand-muted font-mono text-sm italic">&ldquo;{summary.encouragement}&rdquo;</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/career?roadmap_id=${roadmapId}&skill=${skill}&level=${level}`)}
              className="flex-1 border border-brand-border text-brand-muted py-3 rounded-xl font-mono text-sm hover:text-brand-text hover:border-brand-yellow/40 transition-colors"
            >
              Practice Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-brand-yellow text-brand-bg py-3 rounded-xl font-mono font-bold text-sm hover:bg-brand-yellow/90 transition-colors"
            >
              Back to Dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <Spinner />
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg flex items-center justify-center"><Spinner /></div>}>
      <InterviewPageContent />
    </Suspense>
  )
}