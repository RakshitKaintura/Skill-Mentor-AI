'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCareerReadiness } from '@/hooks/useCareerReadiness'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import { RadialScore } from '@/components/ui/RadialScore'
import { MetricCard } from '@/components/ui/MetricCard'
import { ChecklistRow } from '@/components/ui/ChecklistRow'
import { ActionButton } from '@/components/ui/ActionButton'
function CareerPageContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const skill = params.get('skill') || ''
  const level = params.get('level') || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const { readiness, loading, certLoading, certUrl, generateCertificate } = useCareerReadiness(
    user?.id, roadmapId, skill, level, user?.email
  )

  if (loading) return (
    <div className="min-h-screen page-tone-warm flex items-center justify-center"><Spinner /></div>
  )

  const scoreColor = readiness
    ? readiness.job_ready ? '#34a853'
      : (readiness.readiness_score ?? 0) >= 50 ? '#fbbc04' : '#ea4335'
    : '#1a73e8'

  return (
    <div className="min-h-screen page-tone-warm">
      <DashboardNavbar />
      <SectionContainer className="py-10 max-w-5xl">

        {/* Header */}
        <div className="mb-8 animate-[fade-up_0.3s_ease_forwards]">
          <div className="inline-flex items-center gap-2 bg-brand-yellow/10 border border-brand-yellow/25 rounded-full px-4 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow animate-pulse" />
            <span className="text-xs font-mono text-brand-yellow uppercase tracking-widest font-bold">Agent 8 · Career Prep</span>
          </div>
          <h1 className="font-display font-black text-4xl text-brand-text mb-2">
            Career <span className="gradient-text">Hub</span>
          </h1>
          <p className="text-brand-muted font-mono text-sm">
            {skill} · {level} · Your path to employment
          </p>
        </div>

        {readiness && (
          <div className="space-y-6">

            {/* Hero score card */}
            <div className="neo-surface rounded-3xl p-8 relative overflow-hidden animate-[fade-up_0.35s_ease_forwards]">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${scoreColor}44, transparent 70%)` }} />
              <div className="flex flex-col md:flex-row items-center gap-8">
                <RadialScore
                  score={readiness.readiness_score ?? 0}
                  size={180}
                  color={scoreColor}
                />
                <div className="flex-1 text-center md:text-left">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold mb-3 ${
                    readiness.job_ready
                      ? 'bg-brand-green/10 text-brand-green border border-brand-green/25'
                      : 'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/25'
                  }`}>
                    {readiness.job_ready ? '🎉 Job Ready!' : '🔥 Building Readiness'}
                  </div>
                  <h2 className="font-display font-black text-2xl text-brand-text mb-2">
                    SkillMentor Readiness Score
                  </h2>
                  <p className="text-brand-muted text-sm leading-relaxed max-w-md">{readiness.message}</p>
                </div>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-[fade-up_0.4s_ease_forwards]">
              <MetricCard label="Projects" value={readiness.avg_project ?? 0} sub="%" icon="🏗️" color="#1a73e8" />
              <MetricCard label="Interviews" value={readiness.avg_interview ?? 0} sub="%" icon="🎤" color="#a142f4" />
              <MetricCard label="Quizzes" value={readiness.avg_quiz ?? 0} sub="%" icon="📝" color="#34a853" />
              <MetricCard label="XP Earned" value={readiness.xp_total ?? 0} sub=" xp" icon="⚡" color="#fbbc04" max={2000} />
            </div>

            {/* Checklist */}
            <div className="neo-surface rounded-2xl p-6 animate-[fade-up_0.45s_ease_forwards]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center">
                  <span className="text-sm">✅</span>
                </div>
                <div>
                  <div className="font-display font-bold text-brand-text text-sm">Job Readiness Checklist</div>
                  <div className="text-xs text-brand-muted font-mono">Complete all to unlock your certificate</div>
                </div>
              </div>
              <div>
                {readiness.checklist.map((item, i) => (
                  <ChecklistRow key={i} item={item.item} done={item.done} value={item.value} />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-4 animate-[fade-up_0.5s_ease_forwards]">
              <ActionButton
                icon="🎤"
                title="Mock Interview"
                desc="Practice technical & behavioral questions with AI coaching"
                onClick={() => router.push(`/interview?skill=${skill}&level=${level}&roadmap_id=${roadmapId}`)}
                accentClass="hover:text-brand-yellow"
              />
              <ActionButton
                icon="📄"
                title="Resume ATS Score"
                desc="Get AI feedback on your resume for ATS compatibility"
                onClick={() => router.push(`/resume?skill=${skill}&level=${level}&roadmap_id=${roadmapId}`)}
                accentClass="hover:text-brand-blue"
              />
            </div>

            {/* Certificate */}
            <div
              className={`neo-surface rounded-2xl p-6 relative overflow-hidden animate-[fade-up_0.55s_ease_forwards] transition-all ${
                readiness.job_ready
                  ? 'border-brand-green/30'
                  : 'opacity-80'
              }`}
            >
              {readiness.job_ready && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 80% 50%, #34a85318 0%, transparent 70%)' }} />
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    readiness.job_ready ? 'bg-brand-green/10' : 'bg-brand-border/50'
                  }`}>
                    <span className="text-2xl">{readiness.job_ready ? '🏆' : '🔒'}</span>
                  </div>
                  <div>
                    <div className="font-display font-bold text-brand-text">Skill Certificate</div>
                    <div className="text-xs font-mono text-brand-muted mt-0.5">
                      {readiness.job_ready
                        ? 'Congratulations — you qualify for a verified certificate!'
                        : 'Complete the checklist above to unlock your certificate'}
                    </div>
                  </div>
                </div>

                {readiness.job_ready && (
                  certUrl ? (
                    <a
                      href={certUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-brand-green text-white px-5 py-2.5 rounded-xl font-mono text-xs font-bold hover:bg-brand-green/90 transition-colors shadow-lg shadow-brand-green/20"
                    >
                      ↓ Download PDF
                    </a>
                  ) : (
                    <button
                      onClick={generateCertificate}
                      disabled={certLoading}
                      className="flex-shrink-0 bg-brand-green text-white px-5 py-2.5 rounded-xl font-mono text-xs font-bold hover:bg-brand-green/90 transition-colors disabled:opacity-50 shadow-lg shadow-brand-green/20"
                    >
                      {certLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating…
                        </span>
                      ) : 'Generate Certificate'}
                    </button>
                  )
                )}
              </div>
            </div>

          </div>
        )}

        {!readiness && !loading && (
          <div className="neo-surface rounded-2xl p-10 text-center">
            <span className="text-4xl mb-4 block">📊</span>
            <p className="text-brand-muted font-mono text-sm">No readiness data found. Complete some lessons, quizzes and interviews first.</p>
          </div>
        )}

      </SectionContainer>
    </div>
  )
}

export default function CareerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-tone-warm flex items-center justify-center"><Spinner /></div>}>
      <CareerPageContent />
    </Suspense>
  )
}