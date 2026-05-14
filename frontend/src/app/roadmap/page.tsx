import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { Play, Map, Target, Trophy } from 'lucide-react'
import type { Roadmap } from '@/types'
import { ShareButton } from '@/components/roadmap/ShareButton'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { PageTransition } from '@/components/ui/PageTransition'

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: roadmap } = await supabase
    .from('roadmaps').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).single() as { data: Roadmap | null }

  const { data: progress } = await supabase
    .from('user_progress').select('*').eq('user_id', user.id).single()

  const { data: lessons } = await supabase
    .from('lessons').select('topic, completed').eq('user_id', user.id).eq('completed', true)

  const completedTopics = new Set((lessons ?? []).map((l: { topic: string }) => l.topic))
  const phases = (roadmap?.phases ?? []) as Roadmap['phases']
  const totalWeeks = Math.max(1, roadmap?.total_weeks ?? 12)
  const currentWeek = roadmap?.current_week ?? 1
  const completedWeeks = Math.max(0, currentWeek - 1)
  const overallProgress = Math.round((completedWeeks / totalWeeks) * 100)

  return (
    <div className="min-h-screen page-tone-cool text-[var(--color-app-text-primary)]">
      <DashboardNavbar userName={profile?.full_name ?? ''} streakDays={progress?.streak_days ?? 0} xpPoints={progress?.xp_points ?? 0} />

      <PageTransition>
        <SectionContainer className="py-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-app-primary)] mb-1">
              <Map size={16} />
              Roadmap
            </div>
            <h1 className="text-4xl font-semibold">{roadmap?.skill ?? 'Your Roadmap'}</h1>
            <p className="text-base text-[var(--color-app-text-secondary)] mt-1">
              {roadmap?.total_weeks} week journey · {phases.length} phases · Week {currentWeek} of {totalWeeks}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {roadmap?.id && <ShareButton roadmapId={roadmap.id} />}
            <Link href="/lesson/current" className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-app-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1765cc] transition-colors">
              <Play size={14} /> Continue Learning
            </Link>
          </div>
        </div>

        <Card className="mb-6 bg-[var(--color-app-surface-cool)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs uppercase tracking-widest font-semibold text-[var(--color-app-text-secondary)]">Overall Progress</div>
            <div className="text-sm font-semibold text-[var(--color-app-primary)]">Week {roadmap?.current_week ?? 0}/{totalWeeks}</div>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--color-app-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4FFFA0] to-[#5B8EFF]"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--color-app-text-secondary)]">
            <span>Start</span>
            <span>Job-Ready</span>
          </div>
        </Card>

        <div className="grid gap-6">
          {phases.map((phase, phaseIdx) => {
            const isCurrent = phase.name === roadmap?.current_phase
            const isCompleted = phase.completed
            const isLocked = !isCompleted && !isCurrent && phaseIdx > phases.findIndex((p) => p.name === roadmap?.current_phase)
            const colorClasses = ['text-[#4FFFA0]', 'text-[#5B8EFF]', 'text-[#C77DFF]', 'text-[#FFD166]']
            const color = colorClasses[phaseIdx % colorClasses.length]
            const phaseWeeks = Array.isArray(phase.weeks) ? phase.weeks : []
            const phaseStart = phaseWeeks[0] ?? 1
            const phaseEnd = phaseWeeks[phaseWeeks.length - 1] ?? phaseStart

            return (
              <Card key={phase.phase} className={cn('bg-[var(--color-app-surface-mint)]', isLocked ? 'opacity-70' : '')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full border',
                        isCompleted ? 'bg-[#4FFFA0]/20 border-[#4FFFA0] text-[#080B14]' : isCurrent ? 'bg-[#5B8EFF]/20 border-[#5B8EFF] ' + color : 'bg-[var(--color-app-bg)] border-[var(--color-app-border)] text-[var(--color-app-text-secondary)]'
                      )}
                    >
                      {isCompleted ? '✓' : phase.phase}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{phase.name}</h2>
                      <p className="text-xs text-[var(--color-app-text-secondary)]">Weeks {phaseStart}-{phaseEnd} · {phase.topics.length} topics</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && <span className="rounded-full bg-[#5B8EFF]/20 px-2 py-0.5 text-xs font-semibold text-[#5B8EFF]">Current</span>}
                    {isCompleted && <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-xs font-semibold text-[#188038]">Completed</span>}
                    {isLocked && <span className="rounded-full bg-[var(--color-app-border)] px-2 py-0.5 text-xs font-semibold text-[var(--color-app-text-secondary)]">Locked</span>}
                  </div>
                </div>

                <p className="text-sm text-[var(--color-app-text-secondary)] mb-4">{phase.description}</p>

                <div className="grid gap-2 md:grid-cols-3">
                  {phase.topics.map((topic, idx) => {
                    const done = completedTopics.has(topic)
                    const current = topic === roadmap?.current_topic
                    return (
                      <div
                        key={`${phase.phase}-${idx}`}
                        className={cn(
                          'rounded-lg border p-3 text-xs font-semibold',
                          done
                            ? 'border-[#4FFFA0]/30 bg-[#4FFFA0]/10 text-[#4FFFA0]'
                            : current
                              ? 'border-[#5B8EFF]/30 bg-[#5B8EFF]/10 text-[#5B8EFF]'
                              : 'border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-text-secondary)]'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <span>{done ? '✓' : current ? '▶' : String(idx + 1).padStart(2, '0')}</span>
                          <span className="truncate">{topic}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {phase.project && (
                  <div className="mt-4 rounded-lg bg-[var(--color-app-surface-warm)] border border-[var(--color-app-border)] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-app-primary)]">
                      <Target size={12} /> Phase Project
                    </div>
                    <p className="text-sm text-[var(--color-app-text-secondary)] mt-1">{phase.project}</p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {roadmap?.final_project && (
          <Card className="mt-6 bg-[var(--color-app-surface-warm)] border-[#f9ab00]/30">
            <div className="flex items-center gap-2 mb-2 text-[var(--color-app-primary)]">
              <Trophy size={18} />
              <h2 className="text-lg font-semibold">Final Capstone Project</h2>
            </div>
            <p className="text-sm text-[var(--color-app-text-secondary)]">{roadmap.final_project}</p>
          </Card>
        )}

        {roadmap?.daily_schedule && (
          <Card className="mt-6 bg-[var(--color-app-surface-lavender)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-app-primary)] mb-1">📅 Daily Schedule</div>
            <p className="text-sm text-[var(--color-app-text-secondary)]">{roadmap.daily_schedule}</p>
          </Card>
        )}
      </SectionContainer>
      </PageTransition>
    </div>
  )
}