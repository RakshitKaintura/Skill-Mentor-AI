'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import type { JobReadiness } from '@/types/week4'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function CareerPageContent() {
  const params    = useSearchParams()
  const router    = useRouter()
  const { user }  = useAuth()
  const [readiness, setReadiness] = useState<JobReadiness | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [certLoading, setCertLoading] = useState(false)
  const [certUrl, setCertUrl] = useState<string | null>(null)
  const fetchKeyRef = useRef<string>('')
  const inFlightRef = useRef(false)

  const skill     = params.get('skill')      || ''
  const level     = params.get('level')      || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const fetchReadiness = useCallback(async () => {
    const userId = user?.id
    if (!userId || !roadmapId) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/career/job-readiness/${userId}?roadmap_id=${roadmapId}`)
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
      // Get user full_name from profile
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data: profile } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
      const fullName = profile?.full_name || user.email?.split('@')[0] || 'Student'

      const res  = await fetch(`${API}/api/career/certificate/generate`, {
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

  return (
    <div className="min-h-screen page-tone-warm">
      <DashboardNavbar />
      <SectionContainer className="py-10">
        <div className="mb-8">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">
            Agent 8 · Career Prep
          </div>
          <h1 className="font-display font-black text-4xl text-brand-text">Career Hub</h1>
          <p className="text-brand-muted font-mono text-sm mt-2">
            {skill} · {level} · Your path to employment
          </p>
        </div>

        {readiness && (
          <>
            {/* Readiness score */}
            <div className="bg-[var(--color-app-surface-warm)] border border-[#f5d59a] rounded-xl p-8 mb-6 text-center">
              <div className={`text-8xl font-display font-black mb-2 ${
                readiness.job_ready ? 'text-brand-green' :
                readiness.readiness_score >= 50 ? 'text-brand-yellow' : 'text-brand-red'
              }`}>
                {readiness.readiness_score}%
              </div>
              <div className="text-brand-text font-mono text-sm font-medium mb-2">
                {readiness.job_ready ? '🎉 Job Ready!' : 'Building towards job ready'}
              </div>
              <p className="text-brand-muted font-mono text-sm">{readiness.message}</p>
            </div>

            {/* Checklist */}
            <div className="bg-[var(--color-app-surface-mint)] border border-[#b7e1c3] rounded-xl p-6 mb-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-4">
                Job Readiness Checklist
              </div>
              <div className="space-y-3">
                {readiness.checklist.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                        item.done
                          ? 'border-brand-green bg-brand-green text-brand-bg'
                          : 'border-brand-border text-transparent'
                      }`}>
                        {item.done && '✓'}
                      </span>
                      <span className={`font-mono text-sm ${item.done ? 'text-brand-text' : 'text-brand-muted'}`}>
                        {item.item}
                      </span>
                    </div>
                    <span className={`font-mono text-xs ${item.done ? 'text-brand-green' : 'text-brand-muted'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => router.push(`/interview?skill=${skill}&level=${level}&roadmap_id=${roadmapId}`)}
                className="bg-[var(--color-app-surface-warm)] border border-[#f5d59a] text-brand-yellow p-5 rounded-xl font-mono text-sm hover:bg-[#fff4de] transition-colors text-left"
              >
                <div className="text-2xl mb-2">🎤</div>
                <div className="font-bold mb-1">Mock Interview</div>
                <div className="text-brand-muted text-xs">Practice technical & behavioral questions</div>
              </button>

              <button
                onClick={() => router.push(`/resume?skill=${skill}&level=${level}&roadmap_id=${roadmapId}`)}
                className="bg-[var(--color-app-surface-lavender)] border border-[#d4c7ff] text-brand-blue p-5 rounded-xl font-mono text-sm hover:bg-[#f1ecff] transition-colors text-left"
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-bold mb-1">Resume ATS Score</div>
                <div className="text-brand-muted text-xs">Build & get AI feedback on your resume</div>
              </button>
            </div>

            {/* Certificate */}
            <div className={`rounded-xl p-6 border ${
              readiness.job_ready
                ? 'bg-brand-green/5 border-brand-green/30'
                : 'bg-[var(--color-app-surface-cool)] border-[var(--color-app-border)] opacity-90'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-brand-text font-mono text-sm font-bold">
                    🏆 Skill Certificate
                  </div>
                  <div className="text-brand-muted font-mono text-xs mt-1">
                    {readiness.job_ready
                      ? 'You qualify for a verified certificate!'
                      : 'Complete the checklist above to unlock your certificate'}
                  </div>
                </div>
                {readiness.job_ready && (
                  certUrl ? (
                    <a
                      href={certUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-brand-green text-brand-bg px-5 py-2 rounded-lg font-mono text-xs font-bold hover:bg-brand-green/90 transition-colors"
                    >
                      ↓ Download
                    </a>
                  ) : (
                    <button
                      onClick={generateCertificate}
                      disabled={certLoading}
                      className="bg-brand-green text-brand-bg px-5 py-2 rounded-lg font-mono text-xs font-bold hover:bg-brand-green/90 transition-colors disabled:opacity-50"
                    >
                      {certLoading ? 'Generating…' : 'Generate Certificate'}
                    </button>
                  )
                )}
              </div>
            </div>
          </>
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