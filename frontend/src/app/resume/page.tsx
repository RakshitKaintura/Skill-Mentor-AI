'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useResumeReview, type ResumeReviewResponse } from '@/hooks/useResumeReview'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import { RadialScore } from '@/components/ui/RadialScore'
import { VerdictBadge } from '@/components/ui/VerdictBadge'

function ReviewPanel({ review }: { review: ResumeReviewResponse }) {
  const score = review.ats_score ?? 0

  return (
    <div className="space-y-6 animate-[fade-up_0.4s_ease_forwards]">
      {/* Score hero */}
      <div className="neo-surface rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-purple/5 pointer-events-none" />
        <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-4">ATS Compatibility Score</div>
        <div className="relative inline-flex items-center justify-center mb-4">
          <RadialScore score={score} size={148} color={score >= 75 ? '#34a853' : score >= 50 ? '#fbbc04' : '#ea4335'} />
        </div>
        {review.verdict && <VerdictBadge verdict={review.verdict} />}
      </div>

      {/* Top improvement */}
      {review.top_improvement && (
        <div className="neo-surface rounded-2xl p-5 border-l-4 border-brand-blue">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚡</span>
            <span className="text-xs font-mono font-bold text-brand-blue uppercase tracking-widest">Top Priority Fix</span>
          </div>
          <p className="text-sm text-brand-text leading-relaxed">{review.top_improvement}</p>
        </div>
      )}

      {/* Missing keywords */}
      {(review.missing_keywords?.length ?? 0) > 0 && (
        <div className="neo-surface rounded-2xl p-5">
          <div className="text-xs font-mono font-bold text-brand-muted uppercase tracking-widest mb-3">
            Missing Keywords
          </div>
          <div className="flex flex-wrap gap-2">
            {review.missing_keywords!.map((kw, idx) => (
              <span
                key={idx}
                className="text-xs font-mono px-3 py-1 rounded-full border bg-brand-yellow/8 border-brand-yellow/25 text-brand-yellow"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Critique */}
      {(review.critique?.length ?? 0) > 0 && (
        <div className="neo-surface rounded-2xl p-5">
          <div className="text-xs font-mono font-bold text-brand-muted uppercase tracking-widest mb-4">
            Section-by-Section Critique
          </div>
          <div className="space-y-3">
            {review.critique!.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-brand-border bg-app-surface p-4 transition-all hover:border-brand-blue/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-red flex-shrink-0" />
                  <span className="text-xs font-mono font-bold text-brand-blue uppercase tracking-wider">
                    {item.section || 'General'}
                  </span>
                </div>
                <p className="text-sm text-brand-text mb-2 leading-relaxed">{item.issue}</p>
                {item.fix && (
                  <div className="flex items-start gap-2 bg-brand-green/5 rounded-lg px-3 py-2 border border-brand-green/15">
                    <span className="text-brand-green text-xs mt-0.5">→</span>
                    <p className="text-xs text-brand-muted leading-relaxed">{item.fix}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="neo-surface rounded-2xl p-10 flex flex-col items-center justify-center text-center h-full min-h-[320px]">
      <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mb-4">
        <span className="text-3xl">📊</span>
      </div>
      <div className="font-display font-bold text-brand-text mb-2">No analysis yet</div>
      <p className="text-sm text-brand-muted max-w-[220px] leading-relaxed">
        Paste your resume and click Run Analysis to get an AI-powered ATS score and feedback.
      </p>
    </div>
  )
}

function ResumePageContent() {
  const params = useSearchParams()
  const { user, loading } = useAuth()

  const skill = params.get('skill') || ''
  const level = params.get('level') || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const { targetRole, setTargetRole, resumeText, setResumeText, reviewing, review, error, submitResume } = useResumeReview(
    user?.id, roadmapId, skill
  )

  if (loading) {
    return (
      <div className="min-h-screen page-tone-cool flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar />

      <SectionContainer className="py-10 max-w-6xl">
        {/* Header */}
        <div className="mb-8 animate-[fade-up_0.3s_ease_forwards]">
          <div className="inline-flex items-center gap-2 bg-brand-blue/10 border border-brand-blue/20 rounded-full px-4 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
            <span className="text-xs font-mono text-brand-blue uppercase tracking-widest font-bold">Agent 8 · Resume ATS</span>
          </div>
          <h1 className="font-display font-black text-4xl text-brand-text mb-2">
            Resume ATS Score
          </h1>
          <p className="text-brand-muted font-mono text-sm">
            {skill || 'Skill'} · {level} · AI-powered ATS analysis & coaching
          </p>
        </div>

        {!roadmapId || !skill ? (
          <div className="neo-surface rounded-2xl p-8 text-center">
            <span className="text-4xl mb-4 block">🔗</span>
            <p className="text-brand-muted font-mono text-sm">Open this page from your Career Hub or Dashboard with a roadmap selected.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input panel */}
            <div className="neo-surface rounded-2xl p-6 space-y-5 animate-[fade-up_0.35s_ease_forwards]">
              <div className="flex items-center gap-3 pb-4 border-b border-brand-border">
                <div className="w-8 h-8 rounded-lg bg-brand-purple/10 flex items-center justify-center">
                  <span className="text-sm">📄</span>
                </div>
                <div>
                  <div className="font-display font-bold text-brand-text text-sm">Resume Input</div>
                  <div className="text-xs text-brand-muted font-mono">Paste your full resume text below</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-brand-muted uppercase tracking-widest mb-2">
                  Target Role
                </label>
                <input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-blue/60 transition-colors"
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-brand-muted uppercase tracking-widest mb-2">
                  Resume Text
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={16}
                  placeholder="Paste your full resume content here including experience, skills, education..."
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-mono text-xs leading-relaxed focus:outline-none focus:border-brand-blue/60 transition-colors resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-brand-muted font-mono">{resumeText.length} characters</span>
                  {resumeText.length > 0 && (
                    <button
                      onClick={() => setResumeText('')}
                      className="text-xs text-brand-muted hover:text-brand-red font-mono transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-brand-red/8 border border-brand-red/20 px-4 py-3 text-sm text-brand-red font-mono">
                  {error}
                </div>
              )}

              <button
                onClick={submitResume}
                disabled={reviewing || !resumeText.trim()}
                className="w-full relative overflow-hidden bg-brand-blue text-white py-3.5 rounded-xl font-mono text-sm font-bold hover:bg-brand-blue/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {reviewing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Resume…
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      Run AI Resume Analysis
                    </>
                  )}
                </span>
                <div className="absolute inset-0 shine-line opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            {/* Results panel */}
            <div>
              {review ? <ReviewPanel review={review} /> : <EmptyState />}
            </div>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

export default function ResumePage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-tone-cool flex items-center justify-center"><Spinner /></div>}>
      <ResumePageContent />
    </Suspense>
  )
}
