import { adminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Map, Target, Trophy, ArrowRight, Brain } from 'lucide-react'
import type { Roadmap } from '@/types'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import ThemeToggle from '@/components/ui/ThemeToggle'

interface Props {
  params: {
    id: string
  }
}

export default async function PublicRoadmapPage({ params }: Props) {
  const { id } = await params

  // Bypass RLS to fetch any roadmap by ID for public viewing
  const { data: roadmap, error } = await adminClient
    .from('roadmaps')
    .select('*, profiles(full_name)')
    .eq('id', id)
    .single()

  if (error || !roadmap) {
    notFound()
  }

  const r = roadmap as Roadmap & { profiles: { full_name: string } | null }
  const phases = r.phases || []
  const totalWeeks = Math.max(1, r.total_weeks || 12)
  const authorName = r.profiles?.full_name?.split(' ')[0] || 'A Learner'

  return (
    <div className="min-h-screen page-tone-cool text-[var(--color-app-text-primary)] pb-20">
      {/* Public Navbar */}
      <nav className="sticky top-0 z-40 w-full border-b border-[var(--color-app-border)] bg-[var(--color-app-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-app-primary)] text-white shadow-sm transition-transform group-hover:scale-105">
              <Brain size={18} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[var(--color-app-text-primary)]">SkillMentor AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link 
              href="/" 
              className="rounded-full bg-[var(--color-app-primary)] px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105 shadow-sm"
            >
              Build Yours
            </Link>
          </div>
        </div>
      </nav>

      {/* CTA Banner */}
      <div className="w-full bg-[var(--color-app-surface-cool)] border-b border-[var(--color-app-border)] py-3 px-5 text-center">
        <p className="text-sm">
          <span className="font-semibold text-[var(--color-app-primary)]">{authorName}</span> generated this {totalWeeks}-week custom roadmap using AI. 
          <Link href="/" className="ml-2 font-bold underline hover:text-[var(--color-app-primary)] transition-colors">Create your own for free →</Link>
        </p>
      </div>

      <SectionContainer className="py-12 max-w-4xl">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5B8EFF]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#5B8EFF] mb-4 border border-[#5B8EFF]/20">
            <Map size={14} />
            Public Roadmap
          </div>
          <h1 className="font-display font-black text-4xl md:text-5xl mb-4" style={{ letterSpacing: '-1px' }}>
            {r.skill}
          </h1>
          <p className="text-base text-[var(--color-app-text-secondary)] mx-auto max-w-2xl">
            A comprehensive, personalized {totalWeeks}-week learning journey from {r.level || 'beginner'} to mastery.
          </p>
        </div>

        <div className="grid gap-6">
          {phases.map((phase, phaseIdx) => {
            const colorClasses = ['text-[#4FFFA0]', 'text-[#5B8EFF]', 'text-[#C77DFF]', 'text-[#FFD166]']
            const color = colorClasses[phaseIdx % colorClasses.length]
            const phaseWeeks = Array.isArray(phase.weeks) ? phase.weeks : []
            const phaseStart = phaseWeeks[0] ?? 1
            const phaseEnd = phaseWeeks[phaseWeeks.length - 1] ?? phaseStart

            return (
              <Card key={phase.phase} className="bg-[var(--color-app-surface)] shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-[var(--color-app-bg)] border-[var(--color-app-border)] font-display font-black text-xl shadow-sm',
                    color
                  )}>
                    {phase.phase}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1">{phase.name}</h2>
                    <p className="text-sm font-semibold text-[var(--color-app-text-secondary)] mb-3">
                      Weeks {phaseStart}-{phaseEnd} · {phase.topics.length} core topics
                    </p>
                    <p className="text-sm text-[var(--color-app-text-primary)] mb-5 leading-relaxed">
                      {phase.description}
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {phase.topics.map((topic, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-bg)] px-3 py-2.5 text-xs font-semibold text-[var(--color-app-text-primary)] flex items-center gap-2 shadow-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorClasses[phaseIdx % colorClasses.length].split('-')[1].replace(']','') }}></div>
                          <span className="truncate">{topic}</span>
                        </div>
                      ))}
                    </div>

                    {phase.project && (
                      <div className="mt-5 rounded-lg bg-[var(--color-app-surface-warm)] border border-[#f9ab00]/30 p-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Target size={40} className="text-[#f9ab00]" />
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-[#b06000] mb-2 uppercase tracking-wider">
                          <Target size={14} /> Phase Project
                        </div>
                        <p className="text-sm text-[var(--color-app-text-primary)] relative z-10">{phase.project}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {r.final_project && (
          <Card className="mt-8 bg-gradient-to-br from-[var(--color-app-surface-mint)] to-[var(--color-app-surface-cool)] border-[#4FFFA0]/40 shadow-md">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mb-4 shadow-sm">
                <Trophy size={32} className="text-[#188038]" />
              </div>
              <h2 className="text-2xl font-black font-display mb-3">Final Capstone Project</h2>
              <p className="text-base text-[var(--color-app-text-primary)] max-w-2xl mx-auto leading-relaxed">
                {r.final_project}
              </p>
            </div>
          </Card>
        )}

        <div className="mt-16 text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Ready to start your own journey?</h2>
          <Link href="/" className={buttonClassName() + " inline-flex px-8 py-4 text-base shadow-lg"}>
            Create Free Roadmap <ArrowRight size={18} />
          </Link>
        </div>
      </SectionContainer>
    </div>
  )
}
