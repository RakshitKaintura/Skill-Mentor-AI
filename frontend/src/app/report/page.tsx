'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import type { ReportCard } from '@/types/week3'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ReportListResponse {
  reports?: ReportCard[]
}

interface GenerateReportResponse {
  success?: boolean
  report?: ReportCard
  detail?: string
}

function normalizeReport(report: ReportCard): ReportCard {
  const lessonsDone = Number(report.lessons_done ?? 0)
  const quizzesDone = Number(report.quizzes_done ?? 0)
  const challengesDone = Number(report.challenges_done ?? 0)
  const avgScore = Number(report.avg_score ?? 0)
  const streak = Number(report.streak ?? 0)
  const xpTotal = Number(report.xp_total ?? 0)

  return {
    ...report,
    overall_grade: report.overall_grade || 'N/A',
    grade_reasoning: report.grade_reasoning || 'No grade reasoning available yet.',
    summary: report.summary || 'No summary available yet.',
    strengths: Array.isArray(report.strengths) ? report.strengths : [],
    weaknesses: Array.isArray(report.weaknesses) ? report.weaknesses : [],
    recommendations: Array.isArray(report.recommendations) ? report.recommendations : [],
    motivational_message: report.motivational_message || 'Keep going, you are making steady progress.',
    next_week_focus: report.next_week_focus || 'Continue practicing core topics from this week.',
    lessons_done: lessonsDone,
    quizzes_done: quizzesDone,
    challenges_done: challengesDone,
    avg_score: Math.max(0, Math.min(avgScore, 100)),
    streak,
    xp_total: xpTotal,
  }
}

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Unexpected error'
}

export default function ReportPage() {
  const params    = useSearchParams()
  const router    = useRouter()
  const { user }  = useAuth()
  const [report, setReport]     = useState<ReportCard | null>(null)
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const roadmapId  = params.get('roadmap_id') || ''
  const weekNumber = parseInt(params.get('week') || '1')

  useEffect(() => {
    if (user && roadmapId) fetchReport()
  }, [user, roadmapId])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/progress/report-card/${user?.id}?roadmap_id=${roadmapId}`)
      const data = await res.json() as ReportListResponse
      const reports = data.reports || []
      const thisWeek = reports.find((r) => r.week_number === weekNumber)
      if (thisWeek) setReport(normalizeReport(thisWeek))
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (!user) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/progress/report-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, roadmap_id: roadmapId, week_number: weekNumber
        }),
      })
      const data = await res.json() as GenerateReportResponse
      if (data.success && data.report) setReport(normalizeReport(data.report))
      else throw new Error(data.detail || 'Failed to generate report')
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  const gradeColor = (g: string) => {
    if (g === 'A') return 'text-brand-green'
    if (g === 'B') return 'text-brand-blue'
    if (g === 'C') return 'text-brand-yellow'
    return 'text-brand-red'
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <Spinner />
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <button onClick={() => router.back()} className="text-brand-muted font-mono text-xs hover:text-brand-text mb-4 block">
            ← Back
          </button>
          <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-2">Progress Tracker</div>
          <h1 className="font-display font-black text-4xl text-brand-text">
            Week {weekNumber} Report
          </h1>
        </div>

        {error && (
          <div className="bg-brand-red/10 border border-brand-red/30 rounded p-4 mb-6 text-brand-red font-mono text-sm">
            {error}
          </div>
        )}

        {!report ? (
          <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="font-display font-bold text-xl text-brand-text mb-2">No report yet</h2>
            <p className="text-brand-muted font-mono text-sm mb-6">
              Generate your Week {weekNumber} AI report card to see detailed analysis of your progress.
            </p>
            <button
              onClick={generateReport}
              disabled={generating}
              className="bg-brand-green text-brand-bg px-8 py-3 rounded-lg font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating…' : '✨ Generate Report Card'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grade card */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
              <div className={`text-9xl font-display font-black ${gradeColor(report.overall_grade)}`}>
                {report.overall_grade}
              </div>
              <p className="text-brand-muted font-mono text-sm mt-2">{report.grade_reasoning}</p>
              {report.pdf_url && (
                <a
                  href={report.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 border border-brand-blue/40 text-brand-blue px-4 py-2 rounded font-mono text-xs hover:bg-brand-blue/5 transition-colors"
                >
                  ↓ Download PDF Report
                </a>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Lessons', value: report.lessons_done, color: 'text-brand-green' },
                { label: 'Quizzes', value: report.quizzes_done, color: 'text-brand-blue' },
                { label: 'Challenges', value: report.challenges_done, color: 'text-brand-yellow' },
                { label: 'Avg Score', value: `${Number(report.avg_score ?? 0).toFixed(0)}%`, color: 'text-brand-purple' },
                { label: 'Streak', value: `${report.streak}d`, color: 'text-brand-red' },
                { label: 'XP Total', value: report.xp_total, color: 'text-brand-green' },
              ].map((s, i) => (
                <div key={i} className="bg-brand-surface border border-brand-border rounded-lg p-4 text-center">
                  <div className={`text-2xl font-display font-black ${s.color}`}>{s.value}</div>
                  <div className="text-brand-muted font-mono text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Summary</div>
              <p className="text-brand-text text-sm leading-relaxed">{report.summary}</p>
            </div>

            {/* Strengths */}
            <div className="bg-brand-surface border border-brand-green/20 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-3">✓ Strengths</div>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-brand-text text-sm flex gap-2">
                    <span className="text-brand-green mt-0.5">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            {report.weaknesses.length > 0 && (
              <div className="bg-brand-surface border border-brand-red/20 rounded-xl p-6">
                <div className="text-xs font-mono text-brand-red uppercase tracking-widest mb-3">Areas to Improve</div>
                <ul className="space-y-2">
                  {report.weaknesses.map((w, i) => (
                    <li key={i} className="text-brand-text text-sm flex gap-2">
                      <span className="text-brand-red mt-0.5">→</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action plan */}
            <div className="bg-brand-surface border border-brand-blue/20 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">Action Plan for Week {weekNumber + 1}</div>
              <ol className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="text-brand-text text-sm flex gap-3">
                    <span className="text-brand-blue font-mono flex-shrink-0">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>

            {/* Next week focus */}
            <div className="bg-brand-surface border border-brand-yellow/30 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-3">Next Week&apos;s Focus</div>
              <p className="text-brand-text text-sm leading-relaxed">{report.next_week_focus}</p>
            </div>

            {/* Motivational message */}
            <div className="text-center py-4">
              <p className="text-brand-muted font-mono text-sm italic">&quot;{report.motivational_message}&quot;</p>
            </div>

            {/* Regenerate */}
            <div className="flex gap-3">
              <button
                onClick={generateReport}
                disabled={generating}
                className="flex-1 border border-brand-border text-brand-muted py-3 rounded-lg font-mono text-sm hover:border-brand-green/40 hover:text-brand-text transition-colors disabled:opacity-40"
              >
                {generating ? 'Regenerating…' : '↺ Regenerate'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-brand-green text-brand-bg py-3 rounded-lg font-mono text-sm font-bold hover:bg-brand-green/90 transition-colors"
              >
                Continue Learning →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}