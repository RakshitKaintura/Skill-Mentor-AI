'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import type { JobReadiness } from '@/types/week4'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// --- Circular SVG progress ring ---
function RadialScore({
  score,
  size = 180,
  label,
  color,
}: {
  score: number
  size?: number
  label?: string
  color: string
}) {
  const r = (size - 18) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg] absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-app-border)" strokeWidth={12} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={12}
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        </svg>
        <div className="flex flex-col items-center justify-center z-10">
          <span className="font-display font-black text-5xl leading-none" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-brand-muted font-mono">/ 100</span>
        </div>
      </div>
      {label && <span className="text-xs font-mono text-brand-muted uppercase tracking-widest">{label}</span>}
    </div>
  )
}

// --- Mini metric ring ---
function MiniRing({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  const size = 52
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * (pct / 100)
  return (
    <svg width={size} height={size} className="rotate-[-90deg] flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-app-border)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  )
}

function MetricCard({
  label,
  value,
  sub,
  color,
  icon,
  max = 100,
}: {
  label: string
  value: number
  sub: string
  color: string
  icon: string
  max?: number
}) {
  return (
    <div className="neo-surface rounded-2xl p-5 tilt-card flex items-center gap-4">
      <div className="relative">
        <MiniRing value={value} max={max} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg" style={{ transform: 'rotate(90deg)' }}>{icon}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="font-display font-black text-2xl leading-none" style={{ color }}>
          {value.toFixed(0)}<span className="text-sm text-brand-muted font-mono">{sub}</span>
        </div>
        <div className="text-xs font-mono text-brand-muted mt-1 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}

function ChecklistRow({ item, done, value }: { item: string; done: boolean; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0 group">
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          done
            ? 'border-brand-green bg-brand-green shadow-[0_0_10px_#34a85355]'
            : 'border-brand-border bg-transparent'
        }`}>
          {done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <span className={`font-mono text-sm ${done ? 'text-brand-text' : 'text-brand-muted'}`}>{item}</span>
      </div>
      <span className={`font-mono text-sm font-bold ${done ? 'text-brand-green' : 'text-brand-muted'}`}>{value}</span>
    </div>
  )
}

function ActionButton({
  icon,
  title,
  desc,
  onClick,
  accentClass,
}: {
  icon: string
  title: string
  desc: string
  onClick: () => void
  accentClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={`neo-surface tilt-card rounded-2xl p-6 text-left w-full group transition-all border-2 border-transparent hover:border-current ${accentClass}`}
    >
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <div className="font-display font-bold text-base mb-1 text-brand-text">{title}</div>
      <div className="text-xs font-mono text-brand-muted leading-relaxed">{desc}</div>
    </button>
  )
}

function CareerPageContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [readiness, setReadiness] = useState<JobReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)
  const [certUrl, setCertUrl] = useState<string | null>(null)
  const fetchKeyRef = useRef<string>('')
  const inFlightRef = useRef(false)

  const skill = params.get('skill') || ''
  const level = params.get('level') || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const fetchReadiness = useCallback(async () => {
    const userId = user?.id
    if (!userId || !roadmapId) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/career/job-readiness/${userId}?roadmap_id=${roadmapId}`)
      const data = await res.json()
      if (data.success) setReadiness(data.readiness)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [user?.id, roadmapId])

  useEffect(() => {
    if (!user || !skill || !roadmapId) return
    const key = `${user.id}|${roadmapId}|${skill}`
    if (fetchKeyRef.current === key || inFlightRef.current) return
    fetchKeyRef.current = key
    void fetchReadiness()
  }, [user, skill, roadmapId, fetchReadiness])

  const generateCertificate = async () => {
    if (!user || !readiness?.job_ready) return
    setCertLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data: profile } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
      const fullName = profile?.full_name || user.email?.split('@')[0] || 'Student'

      const res = await fetch(`${API}/api/career/certificate/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, roadmap_id: roadmapId,
          skill, level, full_name: fullName,
        }),
      })
      const data = await res.json()
      if (data.success) setCertUrl(data.certificate.pdf_url)
    } finally {
      setCertLoading(false)
    }
  }

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