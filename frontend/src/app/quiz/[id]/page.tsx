'use client'
import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuiz } from '@/hooks/useQuiz'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import CodeBlock from '@/components/lesson/CodeBlock'
import Spinner from '@/components/ui/Spinner'

export default function QuizPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const {
    quiz, result, loading, submitting, error,
    timeLeft, answers,
    generateQuiz, answerQuestion, submitQuiz, loadQuizById,
  } = useQuiz()

  const startTimeRef                  = useRef<number>(0)
  const routeParams = useParams<{ id: string }>()

  // Read query params
  useEffect(() => {
    const routeQuizId = routeParams?.id || ''
    if (!user || !routeQuizId) return

    if (routeQuizId !== 'new') {
      startTimeRef.current = Date.now()
      loadQuizById(routeQuizId, user.id)
      return
    }

    const sp = new URLSearchParams(window.location.search)
    const topic      = sp.get('topic')      || ''
    const skill      = sp.get('skill')      || ''
    const roadmapId  = sp.get('roadmap_id') || ''
    const lessonId   = sp.get('lesson_id')  || undefined
    const difficulty = sp.get('difficulty') || 'beginner'
    const weekNum    = parseInt(sp.get('week') || '1')

    if (user && topic && skill && roadmapId) {
      startTimeRef.current = Date.now()
      generateQuiz({
        user_id: user.id, roadmap_id: roadmapId,
        lesson_id: lessonId, topic, skill,
        week_number: weekNum, difficulty,
      })
    }
  }, [user, routeParams?.id, generateQuiz, loadQuizById])

  const handleSubmit = () => {
    if (!quiz || !user) return
    const taken = Math.floor((Date.now() - startTimeRef.current) / 1000)
    submitQuiz(quiz.quiz_id, user.id, taken)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const answeredCount = Object.keys(answers).length
  const totalQ        = quiz?.questions.length || 0
  const progress      = totalQ ? (answeredCount / totalQ) * 100 : 0

  // ── Results screen ──────────────────────────────────────
  if (result) {
    const pct = result.percentage
    const gradeColor = pct >= 80 ? 'text-brand-green' : pct >= 60 ? 'text-brand-yellow' : 'text-brand-red'
    return (
      <div className="min-h-screen bg-brand-bg">
        <DashboardNavbar />
        <div className="max-w-3xl mx-auto px-6 py-10">
          {/* Score header */}
          <div className="text-center mb-10">
            <div className={`text-8xl font-display font-black mb-2 ${gradeColor}`}>
              {pct.toFixed(0)}%
            </div>
            <div className="text-brand-muted font-mono text-sm mb-1">
              {result.score} / {result.total_points} points
            </div>
            <div className={`inline-block px-4 py-1 rounded text-sm font-mono border mt-3 ${
              result.passed
                ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                : 'border-brand-red/40 bg-brand-red/10 text-brand-red'
            }`}>
              {result.passed ? '✓ PASSED' : '✗ NOT PASSED'} · +{result.xp_awarded} XP
            </div>
          </div>

          {/* AI Feedback */}
          <div className="bg-brand-surface border border-brand-border rounded-lg p-6 mb-8">
            <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">
              AI Feedback
            </div>
            <p className="text-brand-text text-sm leading-relaxed">{result.feedback}</p>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-4 mb-8">
            {result.results.map((r, i) => (
              <div
                key={i}
                className={`border rounded-lg p-5 ${
                  r.is_correct
                    ? 'border-brand-green/30 bg-brand-green/5'
                    : 'border-brand-red/30 bg-brand-red/5'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-brand-text text-sm font-medium">Q{i + 1}. {r.question}</span>
                  <span className={`text-xs font-mono ml-4 flex-shrink-0 ${r.is_correct ? 'text-brand-green' : 'text-brand-red'}`}>
                    {r.is_correct ? `+${r.points_earned}pts` : '0pts'}
                  </span>
                </div>
                <div className="text-xs font-mono space-y-1">
                  {!r.is_correct && (
                    <div className="text-brand-red">Your answer: {r.user_answer ?? 'Not answered'}</div>
                  )}
                  <div className="text-brand-green">Correct: {r.correct_answer}</div>
                  <div className="text-brand-muted mt-2 leading-relaxed">{r.explanation}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 border border-brand-border text-brand-text py-3 rounded-lg font-mono text-sm hover:border-brand-blue/50 transition-colors"
            >
              ← Back to Lesson
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-brand-green text-brand-bg py-3 rounded-lg font-mono text-sm font-bold hover:bg-brand-green/90 transition-colors"
            >
              Continue Learning →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <Spinner />
          <p className="text-brand-muted font-mono text-sm mt-4">Generating your quiz…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-brand-red font-mono mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-brand-blue font-mono text-sm hover:underline">
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  // ── Quiz UI ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-brand-surface border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <div className="text-brand-text font-mono text-sm font-medium">{quiz.topic}</div>
            <div className="text-brand-muted font-mono text-xs">{answeredCount} / {totalQ} answered</div>
          </div>
          <div className={`font-mono text-lg font-bold tabular-nums ${
            timeLeft < 60 ? 'text-brand-red' : timeLeft < 120 ? 'text-brand-yellow' : 'text-brand-text'
          }`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-brand-border">
          <div
            className="h-1 bg-brand-green transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {quiz.questions.map((q, idx) => (
          <div key={q.id} className="bg-brand-surface border border-brand-border rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-mono text-brand-muted uppercase tracking-widest">
                Q{idx + 1} · {q.type.replace('_', ' ')} · {q.points}pts
              </span>
              {answers[q.id] && (
                <span className="text-brand-green text-xs font-mono">✓ Answered</span>
              )}
            </div>
            <p className="text-brand-text text-sm leading-relaxed mb-5">{q.question}</p>

            {/* Code snippet for code_output type */}
            {q.code_snippet && (
              <div className="mb-5">
                <CodeBlock code={q.code_snippet} language="javascript" />
              </div>
            )}

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => answerQuestion(q.id, opt)}
                  className={`w-full text-left px-4 py-3 rounded-lg border font-mono text-sm transition-all ${
                    answers[q.id] === opt
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-brand-border text-brand-text hover:border-brand-blue/40 hover:bg-brand-surface'
                  }`}
                >
                  <span className="text-brand-muted mr-3">
                    {String.fromCharCode(65 + oi)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Submit */}
        <div className="sticky bottom-6">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-brand-green text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-green/20"
          >
            {submitting
              ? 'Evaluating…'
              : `Submit Quiz (${answeredCount}/${totalQ} answered)`}
          </button>
        </div>
      </div>
    </div>
  )
}