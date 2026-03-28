import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { ArrowRight, BookOpen, Mic, Flame, Star, Map, Clock, Target } from 'lucide-react'
import type { Roadmap, UserProgress } from '@/types'
import { cn } from '@/lib/utils'

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
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} streakDays={streakDays} xpPoints={xpPoints} />

      <div className="max-w-5xl mx-auto px-5 py-10 animate-fade-up">

        {/* Greeting Section */}
        <div className="mb-10">
          <p className="text-sm mb-1 text-brand-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="font-display font-black text-4xl text-brand-text tracking-tighter">
            {greeting()}, {firstName} 👋
          </h1>
          {roadmap && (
            <p className="mt-2 text-sm text-brand-muted">
              Learning <span className="text-brand-green font-bold">{roadmap.skill}</span>
              {' '}· Week {currentWeek} of {totalWeeks}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8 bg-brand-border rounded-sm overflow-hidden border border-brand-border">
          {[
            { label: 'Lessons Done', value: lessonsCompleted, color: 'text-brand-green', Icon: BookOpen },
            { label: 'Day Streak', value: streakDays, color: 'text-brand-yellow', Icon: Flame },
            { label: 'XP Points', value: xpPoints, color: 'text-brand-purple', Icon: Star },
            { label: 'Study Hours', value: Math.round(studyMinutes / 60), color: 'text-brand-blue', Icon: Clock },
          ].map((item) => (
            <div key={item.label} className="py-6 text-center bg-brand-surface">
              <item.Icon size={14} className={cn("mx-auto mb-2", item.color)} />
              <div className={cn("font-display font-black text-3xl mb-1", item.color)}>{item.value}</div>
              <div className="text-[10px] tracking-widest uppercase text-brand-muted font-bold">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Continue Today Hero Card */}
        {roadmap && (
          <div className="glass-card p-6 mb-6 border-brand-green/20 bg-linear-to-br from-brand-green/4 to-transparent">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2 text-brand-green">CONTINUE TODAY</p>
                <h2 className="font-display font-bold text-xl mb-1 tracking-tight text-brand-text">
                  {roadmap.current_topic}
                </h2>
                <p className="text-xs text-brand-muted">
                  {roadmap.current_phase} · Week {currentWeek}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/lesson/current"
                  className="flex items-center gap-2 px-5 py-3 bg-brand-green text-brand-bg rounded-sm font-display font-bold text-sm hover:scale-[1.02] transition-transform">
                  <BookOpen size={14} /> Start Lesson
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs mb-1.5 text-brand-muted">
                <span>Overall progress</span>
                <span className="text-brand-green font-bold">{weekProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-brand-border">
                <div className="h-1.5 rounded-full transition-all duration-700 bg-linear-to-r from-brand-green to-brand-blue"
                  style={{ width: `${weekProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">

          {/* Roadmap Phases Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-brand-text">
                <Map size={16} className="text-brand-blue" />
                <h3 className="font-display font-bold text-base">Your Roadmap</h3>
              </div>
              <Link href="/roadmap" className="text-xs text-brand-blue hover:underline">
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
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors",
                      phase.completed 
                        ? "bg-brand-green border-brand-green text-brand-bg" 
                        : isCurrent 
                          ? "bg-brand-surface border-brand-muted text-brand-text" 
                          : "bg-brand-surface2 border-brand-border text-brand-muted"
                    )}>
                      {phase.completed ? '✓' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold truncate text-brand-text">{phase.name}</p>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-brand-green/10 text-brand-green font-bold uppercase">
                            NOW
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-muted font-mono">
                        Wk {startWk}–{endWk} · {phase.topics.length} topics
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Lessons Card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-brand-text">
                <BookOpen size={16} className="text-brand-purple" />
                <h3 className="font-display font-bold text-base">Recent Lessons</h3>
              </div>
              <Link href="/lesson" className="text-xs text-brand-purple hover:underline">
                All Lessons →
              </Link>
            </div>
            {recentLessons && recentLessons.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recentLessons.map((lesson: { id: string; topic: string; completed: boolean; created_at: string }) => (
                  <Link 
                    key={lesson.id} 
                    href={`/lesson/${lesson.id}`}
                    className="flex items-center gap-3 py-2 border-b border-brand-border last:border-0 hover:bg-white/2 transition-colors rounded-sm px-2 -mx-2"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px]",
                      lesson.completed ? "bg-brand-green/10 text-brand-green" : "bg-brand-blue/10 text-brand-blue"
                    )}>
                      {lesson.completed ? '✓' : '▶'}
                    </div>
                    <p className="text-xs flex-1 truncate font-bold text-brand-text">{lesson.topic}</p>
                    <p className="text-[10px] text-brand-muted uppercase font-bold">
                      {new Date(lesson.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen size={28} className="mx-auto mb-3 text-brand-muted" />
                <p className="text-sm mb-4 text-brand-muted">No lessons yet</p>
                <Link href="/lesson/current"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-brand-bg rounded-sm text-xs font-bold hover:scale-105 transition-transform">
                  Start First Lesson <ArrowRight size={11} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { href: '/daily-challenge', Icon: Flame, color: 'text-brand-yellow', label: 'Daily Challenge' },
            { href: `/project${week4Query}`, Icon: Target, color: 'text-brand-yellow', label: 'Project Mentor' },
            { href: `/interview${week4Query}`, Icon: Mic, color: 'text-brand-blue', label: 'Mock Interview' },
            { href: `/career${week4Query}`, Icon: Star, color: 'text-brand-green', label: 'Career Hub' },
            { href: `/resume${week4Query}`, Icon: BookOpen, color: 'text-brand-purple', label: 'Resume ATS Score' },
          ].map((action) => (
            <Link 
              key={action.href} 
              href={action.href}
              className="glass-card flex items-center gap-3 p-4 transition-all hover:border-brand-muted hover:-translate-y-0.5 group"
            >
              <action.Icon size={15} className={cn("transition-colors", action.color)} />
              <span className="text-xs font-display font-bold text-brand-text group-hover:text-brand-green transition-colors">{action.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}