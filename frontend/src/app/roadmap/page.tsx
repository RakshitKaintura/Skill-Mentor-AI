import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { CheckCircle, Lock, Play, Map, Target, Trophy } from 'lucide-react'
import type { Roadmap } from '@/types'

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
  const phases          = (roadmap?.phases ?? []) as Roadmap['phases']
  const totalWeeks      = roadmap?.total_weeks ?? 12

  return (
    <div className="min-h-screen">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={progress?.xp_points ?? 0}
      />

      <div className="max-w-5xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Map size={16} style={{ color: '#4FFFA0' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color: '#4FFFA0' }}>
                Learning Roadmap
              </span>
            </div>
            <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>
              {roadmap?.skill ?? 'Your Roadmap'}
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#6B7A99' }}>
              {roadmap?.total_weeks} week journey · {phases.length} phases ·{' '}
              Week {roadmap?.current_week ?? 1} of {roadmap?.total_weeks ?? 12}
            </p>
          </div>
          <Link href="/lesson/current"
            className="flex items-center gap-2 px-5 py-3 rounded-sm font-display font-bold text-sm"
            style={{ background: '#4FFFA0', color: '#080B14' }}>
            <Play size={14} /> Continue Learning
          </Link>
        </div>

        {/* Overall progress bar */}
        {roadmap && (
          <div className="glass-card p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold" style={{ color: '#6B7A99' }}>OVERALL PROGRESS</span>
              <span className="text-sm font-bold" style={{ color: '#4FFFA0' }}>
                Week {roadmap.current_week}/{roadmap.total_weeks}
              </span>
            </div>
            <div className="h-2 rounded-full" style={{ background: '#1E2A42' }}>
              <div className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((roadmap.current_week / totalWeeks) * 100)}%`,
                  background: 'linear-gradient(90deg, #4FFFA0, #5B8EFF)',
                }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs" style={{ color: '#6B7A99' }}>Start</span>
              <span className="text-xs" style={{ color: '#6B7A99' }}>Job-Ready</span>
            </div>
          </div>
        )}

        {/* Phases */}
        <div className="flex flex-col gap-6">
          {phases.map((phase, phaseIdx) => {
            const isCurrentPhase = phase.name === roadmap?.current_phase
            const isCompleted    = phase.completed
            const isLocked       = !isCompleted && !isCurrentPhase &&
                                   phaseIdx > phases.findIndex(p => p.name === roadmap?.current_phase)
            const phaseWeeks      = Array.isArray(phase.weeks) ? phase.weeks : []
            const phaseWeekStart  = phaseWeeks[0] ?? 1
            const phaseWeekEnd    = phaseWeeks[phaseWeeks.length - 1] ?? phaseWeekStart

            const phaseColors = ['#4FFFA0', '#5B8EFF', '#C77DFF', '#FFD166']
            const color       = phaseColors[phaseIdx % phaseColors.length]

            return (
              <div key={phase.phase}
                className="glass-card overflow-hidden transition-all duration-200"
                style={{
                  borderColor: isCurrentPhase ? color + '40' : isCompleted ? 'rgba(79,255,160,0.2)' : '#1E2A42',
                  opacity: isLocked ? 0.5 : 1,
                }}>

                {/* Phase header */}
                <div className="flex items-center justify-between p-6 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-display font-black text-lg"
                      style={{
                        background: isCompleted ? '#4FFFA0' : isCurrentPhase ? color + '20' : '#141B2D',
                        color:      isCompleted ? '#080B14' : isCurrentPhase ? color        : '#6B7A99',
                        border:     `2px solid ${isCompleted ? '#4FFFA0' : isCurrentPhase ? color : '#1E2A42'}`,
                      }}>
                      {isCompleted ? '✓' : phase.phase}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-display font-bold text-lg">{phase.name}</h2>
                        {isCurrentPhase && (
                          <span className="text-xs px-2 py-0.5 rounded-sm font-bold"
                            style={{ background: color + '15', color, border: `1px solid ${color}30` }}>
                            CURRENT
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs px-2 py-0.5 rounded-sm font-bold"
                            style={{ background: 'rgba(79,255,160,0.1)', color: '#4FFFA0', border: '1px solid rgba(79,255,160,0.2)' }}>
                            COMPLETED
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-xs px-2 py-0.5 rounded-sm"
                            style={{ background: '#141B2D', color: '#6B7A99', border: '1px solid #1E2A42' }}>
                            LOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>
                        Weeks {phaseWeekStart}–{phaseWeekEnd} · {phase.topics.length} topics
                      </p>
                    </div>
                  </div>
                  {isLocked && <Lock size={16} style={{ color: '#6B7A99' }} />}
                </div>

                {/* Phase description */}
                <div className="px-6 pb-4">
                  <p className="text-sm" style={{ color: '#6B7A99' }}>{phase.description}</p>
                </div>

                {/* Topics grid */}
                <div className="px-6 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {phase.topics.map((topic: string, i: number) => {
                      const done    = completedTopics.has(topic)
                      const current = topic === roadmap?.current_topic

                      return (
                        <div key={i}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-sm text-xs transition-all"
                          style={{
                            background: done    ? 'rgba(79,255,160,0.06)'  :
                                        current ? color + '10' : '#141B2D',
                            border:     `1px solid ${done ? 'rgba(79,255,160,0.2)' : current ? color + '30' : '#1E2A42'}`,
                            color:      done    ? '#4FFFA0' :
                                        current ? color     : '#6B7A99',
                          }}>
                          <span>
                            {done ? '✓' : current ? '▶' : String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="truncate font-display font-bold">{topic}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Project */}
                <div className="mx-6 mb-5 p-4 rounded-sm"
                  style={{ background: color + '08', border: `1px solid ${color}20` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Target size={12} style={{ color }} />
                    <span className="text-xs font-bold" style={{ color }}>PHASE PROJECT</span>
                  </div>
                  <p className="text-sm" style={{ color: '#C4CFEA' }}>{phase.project}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Final project + job readiness */}
        {roadmap?.final_project && (
          <div className="mt-8 glass-card p-6" style={{ borderColor: 'rgba(255,209,102,0.3)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} style={{ color: '#FFD166' }} />
              <h3 className="font-display font-bold text-base" style={{ color: '#FFD166' }}>
                Final Capstone Project
              </h3>
            </div>
            <p className="text-sm mb-5" style={{ color: '#C4CFEA' }}>{roadmap.final_project}</p>

            {Array.isArray(roadmap.job_readiness_checklist) && roadmap.job_readiness_checklist.length > 0 && (
              <>
                <p className="text-xs font-bold mb-3" style={{ color: '#6B7A99' }}>JOB READINESS CHECKLIST</p>
                <div className="grid grid-cols-2 gap-2">
                  {(roadmap.job_readiness_checklist as string[]).map((item: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1" style={{ color: '#6B7A99' }}>
                      <CheckCircle size={12} style={{ color: '#FFD166', flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Daily schedule */}
        {roadmap?.daily_schedule && (
          <div className="mt-4 glass-card px-5 py-4 flex items-start gap-3"
            style={{ borderColor: 'rgba(91,142,255,0.2)' }}>
            <span style={{ color: '#5B8EFF' }}>📅</span>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: '#5B8EFF' }}>YOUR DAILY SCHEDULE</p>
              <p className="text-sm" style={{ color: '#6B7A99' }}>{roadmap.daily_schedule}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
