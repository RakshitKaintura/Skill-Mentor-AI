import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { BarChart2, Flame, BookOpen, Clock, Trophy, Target, CheckCircle, TrendingUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase
    .from('user_progress').select('*').eq('user_id', user.id).single()

  const { data: roadmap } = await supabase
    .from('roadmaps').select('skill, total_weeks, current_week, phases')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single()

  const { data: recentLessons } = await supabase
    .from('lessons')
    .select('id, topic, completed, completed_at, created_at, week_number')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { count: doubtCount } = await supabase
    .from('doubts').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

  const xp              = progress?.xp_points ?? 0
  const streak          = progress?.streak_days ?? 0
  const lessonsComplete = progress?.lessons_completed ?? 0
  const studyMins       = progress?.total_study_minutes ?? 0
  const studyHours      = Math.round(studyMins / 60)
  const weekProgress    = roadmap ? Math.round((roadmap.current_week / roadmap.total_weeks) * 100) : 0

  const level      = Math.floor(xp / 500) + 1
  const xpInLevel  = xp % 500
  const xpToNext   = 500

  const BADGES = [
    { id: 'first_lesson', icon: '🎯', name: 'First Step',   desc: 'Completed your first lesson',   unlocked: lessonsComplete >= 1  },
    { id: 'streak_3',     icon: '🔥', name: '3-Day Streak', desc: 'Studied 3 days in a row',       unlocked: streak >= 3           },
    { id: 'streak_7',     icon: '⚡', name: 'Week Warrior', desc: 'Studied 7 days in a row',       unlocked: streak >= 7           },
    { id: 'lessons_5',    icon: '📚', name: 'Avid Learner', desc: 'Completed 5 lessons',           unlocked: lessonsComplete >= 5  },
    { id: 'lessons_10',   icon: '🏅', name: 'Dedicated',    desc: 'Completed 10 lessons',          unlocked: lessonsComplete >= 10 },
    { id: 'doubt_5',      icon: '🤔', name: 'Curious Mind', desc: 'Asked 5 doubts',                unlocked: (doubtCount ?? 0) >= 5 },
    { id: 'xp_500',       icon: '⭐', name: 'Level 2',      desc: 'Reached 500 XP',               unlocked: xp >= 500             },
    { id: 'xp_1000',      icon: '💫', name: 'Level 3',      desc: 'Reached 1000 XP',              unlocked: xp >= 1000            },
  ]

  return (
    <div className="min-h-screen page-tone-cool text-[var(--color-app-text-primary)]">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={streak}
        xpPoints={xp}
      />

      <SectionContainer className="py-10 max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={16} className="text-[var(--color-app-primary)]" />
            <span className="text-xs tracking-widest uppercase text-[var(--color-app-primary)]">Progress</span>
          </div>
          <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>
            Your Progress
          </h1>
          <p className="mt-2 text-sm text-[var(--color-app-text-secondary)]">
            {roadmap?.skill ?? 'Learning'} journey · Level {level} learner
          </p>
        </div>

        {/* XP + Level card */}
        <Card className="mb-6 bg-[var(--color-app-surface-lavender)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs tracking-widest uppercase mb-1" style={{ color: '#C77DFF' }}>LEVEL {level}</p>
              <div className="font-display font-black text-4xl" style={{ color: '#C77DFF' }}>
                {xp} <span className="text-lg font-bold">XP</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-black text-2xl"
              style={{ background: 'rgba(199,125,255,0.15)', border: '2px solid rgba(199,125,255,0.4)', color: '#C77DFF' }}>
              {level}
            </div>
          </div>
          <div className="mb-2 flex justify-between text-xs text-[var(--color-app-text-secondary)]">
            <span>{xpInLevel} XP</span><span>{xpToNext} XP to Level {level + 1}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-app-border)]">
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${Math.round(xpInLevel / xpToNext * 100)}%`, background: 'linear-gradient(90deg,#C77DFF,#5B8EFF)' }} />
          </div>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { Icon: BookOpen, label: 'Lessons Done',  value: lessonsComplete, color: '#188038', tone: 'bg-[var(--color-app-surface-mint)]' },
            { Icon: Flame,    label: 'Day Streak',    value: streak,          color: '#f9ab00', tone: 'bg-[var(--color-app-surface-warm)]' },
            { Icon: Clock,    label: 'Study Hours',   value: studyHours,      color: '#1a73e8', tone: 'bg-[var(--color-app-surface-cool)]' },
            { Icon: Target,   label: 'Doubts Asked',  value: doubtCount ?? 0, color: '#7e57c2', tone: 'bg-[var(--color-app-surface-lavender)]' },
          ].map(({ Icon, label, value, color, tone }) => (
            <Card key={label} className={`py-6 text-center ${tone}`}>
              <Icon size={16} className="mx-auto mb-2" style={{ color }} />
              <div className="font-display font-black text-3xl mb-1" style={{ color }}>{value}</div>
              <div className="text-xs tracking-widest uppercase text-[var(--color-app-text-secondary)]">{label}</div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Roadmap progress */}
          {roadmap && (
            <Card className="bg-[var(--color-app-surface-cool)]">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={16} style={{ color: '#4FFFA0' }} />
                <h3 className="font-display font-bold text-base">Roadmap Progress</h3>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5 text-[var(--color-app-text-secondary)]">
                  <span>Week {roadmap.current_week} of {roadmap.total_weeks}</span>
                  <span style={{ color: '#4FFFA0' }}>{weekProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-app-border)]">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${weekProgress}%`, background: 'linear-gradient(90deg,#4FFFA0,#5B8EFF)' }} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {((roadmap.phases ?? []) as Array<{ name: string; completed: boolean; weeks: number[] }>)
                  .map((phase, i) => {
                    const phaseColors = ['#4FFFA0','#5B8EFF','#C77DFF','#FFD166']
                    const color       = phaseColors[i % phaseColors.length]
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            background: phase.completed ? '#4FFFA0' : color + '20',
                            color:      phase.completed ? '#080B14' : color,
                            border:     `1px solid ${phase.completed ? '#4FFFA0' : color + '40'}`,
                            fontSize: '9px', fontWeight: 700,
                          }}>
                          {phase.completed ? '✓' : i + 1}
                        </div>
                        <span style={{ color: phase.completed ? '#188038' : 'var(--color-app-text-secondary)' }}>{phase.name}</span>
                        <span className="ml-auto text-[var(--color-app-text-secondary)]">
                          Wk {phase.weeks[0]}–{phase.weeks[phase.weeks.length - 1]}
                        </span>
                      </div>
                    )
                  })
                }
              </div>
            </Card>
          )}

          {/* Recent activity */}
          <Card className="bg-[var(--color-app-surface-lavender)]">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={16} style={{ color: '#5B8EFF' }} />
              <h3 className="font-display font-bold text-base">Recent Activity</h3>
            </div>
            {recentLessons && recentLessons.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recentLessons.map((lesson: {
                  id: string; topic: string; completed: boolean;
                  created_at: string; week_number: number;
                }) => (
                  <div key={lesson.id} className="flex items-center gap-3 py-2 border-b border-[var(--color-app-border)] last:border-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{
                        background: lesson.completed ? 'rgba(79,255,160,0.1)' : 'rgba(91,142,255,0.1)',
                        color:      lesson.completed ? '#4FFFA0' : '#5B8EFF',
                      }}>
                      {lesson.completed ? '✓' : '▶'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{lesson.topic}</p>
                      <p className="text-xs text-[var(--color-app-text-secondary)]">
                        Week {lesson.week_number} ·{' '}
                        {new Date(lesson.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {lesson.completed && <span className="text-xs text-[#188038]">+100 XP</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-6 text-[var(--color-app-text-secondary)]">
                Complete lessons to see activity here
              </p>
            )}
          </Card>
        </div>

        {/* Badges */}
        <Card className="mt-6 bg-[var(--color-app-surface-warm)]">
          <div className="flex items-center gap-2 mb-5">
            <Trophy size={16} style={{ color: '#FFD166' }} />
            <h3 className="font-display font-bold text-base">Badges</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BADGES.map(badge => (
              <div key={badge.id}
                className="flex flex-col items-center gap-2 p-4 rounded-sm text-center transition-all"
                style={{
                  background:  badge.unlocked ? 'rgba(255,209,102,0.12)'  : 'var(--color-app-surface)',
                  border:      `1px solid ${badge.unlocked ? 'rgba(255,209,102,0.3)' : 'var(--color-app-border)'}`,
                  opacity:     badge.unlocked ? 1 : 0.4,
                }}>
                <span className="text-3xl">{badge.icon}</span>
                <div>
                  <p className="font-display font-bold text-xs" style={{ color: badge.unlocked ? '#b06000' : 'var(--color-app-text-secondary)' }}>
                    {badge.name}
                  </p>
                  <p className="text-xs mt-0.5 text-[var(--color-app-text-secondary)]">{badge.desc}</p>
                </div>
                {badge.unlocked && (
                  <CheckCircle size={12} className="text-[#188038]" />
                )}
              </div>
            ))}
          </div>
        </Card>
      </SectionContainer>
    </div>
  )
}
