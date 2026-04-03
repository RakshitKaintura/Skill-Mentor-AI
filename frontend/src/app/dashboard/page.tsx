import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { ArrowRight, BookOpen, Mic, Flame, Star, Map, Clock, Target } from 'lucide-react'
import type { Roadmap, UserProgress } from '@/types'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  // User may have an auth session but no profile row (e.g., manual deletes in Supabase).
  if (!profile) redirect('/auth/login')

  if (!profile?.onboarding_completed) redirect('/onboarding')

  // Explicitly casting the data to match your local types
  const { data: roadmap } = await supabase
    .from('roadmaps').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).single() as unknown as { data: Roadmap | null }

  const { data: progress } = await supabase
    .from('user_progress').select('*').eq('user_id', user.id).single() as unknown as { data: UserProgress | null }

  const { data: recentLessons } = await supabase
    .from('lessons').select('id, topic, completed, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Learner'
  const streakDays = progress?.streak_days ?? 0
  const xpPoints = progress?.xp_points ?? 0
  const lessonsCompleted = progress?.lessons_completed ?? 0
  const studyMinutes = progress?.total_study_minutes ?? 0
  const phases = (roadmap?.phases as Roadmap['phases']) ?? []
  const currentWeek = roadmap?.current_week ?? 1
  const week4Query = roadmap
    ? `?skill=${encodeURIComponent(roadmap.skill)}&level=${encodeURIComponent(roadmap.level)}&roadmap_id=${encodeURIComponent(roadmap.id)}`
    : ''

  // Logic Fix: Handle the 'total_weeks' or 'total_duration' aliasing
  const totalWeeks = roadmap?.total_duration ?? roadmap?.total_weeks ?? 12
  const weekProgress = Math.round((currentWeek / totalWeeks) * 100)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen page-tone-warm">
      <DashboardNavbar userName={profile?.full_name ?? ''} streakDays={streakDays} xpPoints={xpPoints} />

      <SectionContainer className="py-8 md:py-10">

        {/* Greeting Section */}
        <div className="mb-8">
          <p className="mb-2 text-sm text-[var(--color-app-text-secondary)]">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {greeting()}, {firstName}
          </h1>
          {roadmap && (
            <p className="mt-2 text-base text-[var(--color-app-text-secondary)]">
              Learning <span className="font-semibold text-[var(--color-app-primary)]">{roadmap.skill}</span>
              {' '}· Week {currentWeek} of {totalWeeks}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Lessons Done', value: lessonsCompleted, Icon: BookOpen, tone: 'bg-[var(--color-app-surface-cool)]', icon: 'text-[#1a73e8]' },
            { label: 'Day Streak', value: streakDays, Icon: Flame, tone: 'bg-[var(--color-app-surface-mint)]', icon: 'text-[#188038]' },
            { label: 'XP Points', value: xpPoints, Icon: Star, tone: 'bg-[var(--color-app-surface-warm)]', icon: 'text-[#f9ab00]' },
            { label: 'Study Hours', value: Math.round(studyMinutes / 60), Icon: Clock, tone: 'bg-[var(--color-app-surface-lavender)]', icon: 'text-[#7e57c2]' },
          ].map((item) => (
            <Card key={item.label} className={cn('text-center', item.tone)}>
              <item.Icon size={16} className={cn('mx-auto mb-2', item.icon)} />
              <div className="mb-1 text-3xl font-semibold text-[var(--color-app-text-primary)]">{item.value}</div>
              <div className="text-xs text-[var(--color-app-text-secondary)]">{item.label}</div>
            </Card>
          ))}
        </div>

        {/* Continue Today Hero Card */}
        {roadmap && (
          <Card className="mb-6 bg-[var(--color-app-surface-cool)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-app-primary)]">Continue today</p>
                <h2 className="mb-1 text-xl font-semibold tracking-tight text-[var(--color-app-text-primary)]">
                  {roadmap.current_topic}
                </h2>
                <p className="text-sm text-[var(--color-app-text-secondary)]">
                  {roadmap.current_phase} · Week {currentWeek}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/lesson/current"
                  className={buttonClassName()}>
                  <BookOpen size={14} /> Start Lesson
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm text-[var(--color-app-text-secondary)]">
                <span>Overall progress</span>
                <span className="font-semibold text-[var(--color-app-primary)]">{weekProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-app-bg)]">
                <div className="h-2 rounded-full bg-[var(--color-app-primary)] transition-all duration-700"
                  style={{ width: `${weekProgress}%` }} />
              </div>
            </div>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">

          {/* Roadmap Phases Card */}
          <Card className="bg-[var(--color-app-surface-warm)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-[var(--color-app-text-primary)]">
                <Map size={16} className="text-[var(--color-app-primary)]" />
                <h3 className="text-lg font-semibold">Your Roadmap</h3>
              </div>
              <Link href="/roadmap" className="text-sm text-[var(--color-app-primary)] hover:underline">
                Full View →
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {phases.map((phase, i) => {
                const isCurrent = phase.name === roadmap?.current_phase
                const activeWeeks = phase.duration_weeks ?? phase.weeks ?? [0]
                const startWk = activeWeeks[0]
                const endWk = activeWeeks[activeWeeks.length - 1]

                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      phase.completed 
                          ? "border-[var(--color-app-primary)] bg-[var(--color-app-primary)] text-white" 
                        : isCurrent 
                            ? "border-[var(--color-app-primary)] bg-[#e8f0fe] text-[var(--color-app-primary)]" 
                            : "border-[var(--color-app-border)] bg-[var(--color-app-bg)] text-[var(--color-app-text-secondary)]"
                    )}>
                      {phase.completed ? '✓' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--color-app-text-primary)]">{phase.name}</p>
                        {isCurrent && (
                            <span className="rounded bg-[#e8f0fe] px-2 py-0.5 text-xs font-semibold uppercase text-[var(--color-app-primary)]">
                            NOW
                          </span>
                        )}
                      </div>
                        <p className="text-xs text-[var(--color-app-text-secondary)]">
                        Wk {startWk}–{endWk} · {phase.topics.length} topics
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            </Card>

          {/* Recent Lessons Card */}
            <Card className="bg-[var(--color-app-surface-lavender)]">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-[var(--color-app-text-primary)]">
                  <BookOpen size={16} className="text-[var(--color-app-primary)]" />
                  <h3 className="text-lg font-semibold">Recent Lessons</h3>
              </div>
                <Link href="/lesson" className="text-sm text-[var(--color-app-primary)] hover:underline">
                All Lessons →
              </Link>
            </div>
            {recentLessons && recentLessons.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recentLessons.map((lesson: { id: string; topic: string; completed: boolean; created_at: string }) => (
                  <Link 
                    key={lesson.id} 
                    href={`/lesson/${lesson.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg border-b border-[var(--color-app-border)] px-2 py-3 last:border-0 transition-colors hover:bg-[var(--color-app-bg)]"
                  >
                    <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                        lesson.completed ? "bg-[#e6f4ea] text-[#188038]" : "bg-[#e8f0fe] text-[var(--color-app-primary)]"
                    )}>
                      {lesson.completed ? '✓' : '▶'}
                    </div>
                      <p className="flex-1 truncate text-sm font-semibold text-[var(--color-app-text-primary)]">{lesson.topic}</p>
                      <p className="text-xs text-[var(--color-app-text-secondary)]">
                      {new Date(lesson.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                  <BookOpen size={28} className="mx-auto mb-3 text-[var(--color-app-text-secondary)]" />
                  <p className="mb-4 text-sm text-[var(--color-app-text-secondary)]">No lessons yet</p>
                <Link href="/lesson/current"
                    className={buttonClassName()}>
                  Start First Lesson <ArrowRight size={11} />
                </Link>
              </div>
            )}
            </Card>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
              { href: `/project${week4Query}`, Icon: Target, label: 'Project Mentor', tone: 'bg-[var(--color-app-surface-mint)]', border: 'border-[#b7e1c3]', icon: 'text-[#188038]', hover: 'group-hover:text-[#188038]' },
              { href: `/interview${week4Query}`, Icon: Mic, label: 'Mock Interview', tone: 'bg-[var(--color-app-surface-cool)]', border: 'border-[#b8cef7]', icon: 'text-[#1a73e8]', hover: 'group-hover:text-[#1a73e8]' },
              { href: `/career${week4Query}`, Icon: Star, label: 'Career Hub', tone: 'bg-[var(--color-app-surface-warm)]', border: 'border-[#f5d59a]', icon: 'text-[#f9ab00]', hover: 'group-hover:text-[#b06000]' },
              { href: `/resume${week4Query}`, Icon: BookOpen, label: 'Resume ATS Score', tone: 'bg-[var(--color-app-surface-lavender)]', border: 'border-[#d4c7ff]', icon: 'text-[#7e57c2]', hover: 'group-hover:text-[#7e57c2]' },
          ].map((action) => (
            <Link 
              key={action.href} 
              href={action.href}
                className={cn('group flex items-center gap-3 rounded-xl border p-4 shadow-sm transition-all hover:translate-y-[-1px]', action.tone, action.border)}
            >
                <action.Icon size={15} className={action.icon} />
                <span className={cn('text-sm font-semibold text-[var(--color-app-text-primary)] transition-colors', action.hover)}>{action.label}</span>
            </Link>
          ))}
        </div>

        </SectionContainer>
    </div>
  )
}