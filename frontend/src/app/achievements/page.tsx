import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { Trophy, Star, BookOpen, Flame, Target, Zap, Award, Lock, CheckCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'

type ProgressData = {
  lessonsCompleted: number
  streakDays: number
  xpPoints: number
  doubtsAsked: number
  studyMinutes: number
}

const BADGES = [
  { id: 'first_lesson',  icon: '🎯', name: 'First Step',       desc: 'Complete your first lesson', xp: 50,  category: 'Learning', requirement: (p: ProgressData) => p.lessonsCompleted >= 1 },
  { id: 'lessons_5',     icon: '📚', name: 'Avid Learner',     desc: 'Complete 5 lessons', xp: 150, category: 'Learning', requirement: (p: ProgressData) => p.lessonsCompleted >= 5 },
  { id: 'streak_7',      icon: '⚡', name: 'Week Warrior',     desc: '7-day streak', xp: 200, category: 'Streak', requirement: (p: ProgressData) => p.streakDays >= 7 },
  { id: 'xp_1000',       icon: '💫', name: 'Level 3',          desc: 'Reach 1,000 XP', xp: 0, category: 'XP', requirement: (p: ProgressData) => p.xpPoints >= 1000 },
  { id: 'doubt_5',       icon: '💡', name: 'Inquisitive',      desc: 'Ask 5 doubts', xp: 75, category: 'Curiosity', requirement: (p: ProgressData) => p.doubtsAsked >= 5 },
  { id: 'time_10h',      icon: '🕐', name: 'Ten Hours',        desc: 'Study 10 hours', xp: 200, category: 'Time', requirement: (p: ProgressData) => p.studyMinutes >= 600 },
]

const CATEGORY_META = {
  Learning: { color: 'text-[var(--color-app-primary)]', Icon: BookOpen },
  Streak: { color: 'text-[#FFD166]', Icon: Flame },
  XP: { color: 'text-[#C77DFF]', Icon: Star },
  Curiosity: { color: 'text-[#5B8EFF]', Icon: Target },
  Time: { color: 'text-[#FF8C42]', Icon: Zap },
}

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', user.id).single()
  const { count: doubtsAsked } = await supabase.from('doubts').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

  const progressData: ProgressData = {
    lessonsCompleted: progress?.lessons_completed ?? 0,
    streakDays: progress?.streak_days ?? 0,
    xpPoints: progress?.xp_points ?? 0,
    doubtsAsked: doubtsAsked ?? 0,
    studyMinutes: progress?.total_study_minutes ?? 0,
  }

  const badges = BADGES.map(b => ({ ...b, unlocked: b.requirement(progressData) }))
  const unlocked = badges.filter(b => b.unlocked).length
  const total = badges.length

  return (
    <div className="min-h-screen page-tone-warm text-[var(--color-app-text-primary)]">
      <DashboardNavbar userName={profile?.full_name ?? ''} streakDays={progressData.streakDays} xpPoints={progressData.xpPoints} />
      <SectionContainer className="py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="col-span-2 bg-[var(--color-app-surface-cool)]">
            <div className="flex items-center gap-3 mb-3">
              <Trophy size={18} className="text-[var(--color-app-primary)]" />
              <h1 className="text-3xl font-semibold">Achievements</h1>
            </div>
            <p className="text-sm text-[var(--color-app-text-secondary)]">Earn badges by completing lessons, maintaining streaks, and leveling up.</p>
          </Card>

          <Card className="bg-[var(--color-app-surface-warm)]">
            <div className="text-sm text-[var(--color-app-text-secondary)] uppercase tracking-widest">Badge Progress</div>
            <div className="mt-3 text-4xl font-semibold">{Math.round((unlocked / total) * 100)}%</div>
            <div className="mt-2 text-xs text-[var(--color-app-text-secondary)]">{unlocked} of {total} unlocked</div>
            <div className="mt-3 h-2 w-full rounded-full bg-[var(--color-app-border)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FFD166] to-[#FF8C42]" style={{ width: `${(unlocked/total)*100}%` }} />
            </div>
          </Card>
        </div>

        <div className="grid gap-8">
          {Object.keys(CATEGORY_META).map((category) => {
            const meta = CATEGORY_META[category as keyof typeof CATEGORY_META]
            const categoryBadges = badges.filter((b) => b.category === category)

            return (
              <section key={category}>
                <div className="mb-4 flex items-center gap-2">
                  <meta.Icon size={16} className={meta.color} />
                  <h2 className="text-xl font-semibold">{category}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {categoryBadges.map((badge) => (
                    <Card key={badge.id} className={`${badge.unlocked ? 'bg-[var(--color-app-surface-lavender)]' : 'bg-[var(--color-app-bg)] border border-[var(--color-app-border)] opacity-70'}`}>
                      <div className="text-2xl mb-2">{badge.unlocked ? badge.icon : <Lock size={20} />}</div>
                      <h3 className="text-sm font-semibold">{badge.name}</h3>
                      <p className="text-xs mt-1 text-[var(--color-app-text-secondary)]">{badge.desc}</p>
                      {badge.unlocked && (
                        <div className="mt-3 inline-flex items-center gap-1 text-xs text-[#4FFFA0]">
                          <CheckCircle size={12} /> Unlocked
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {badges.some((b) => !b.unlocked) && (
          <Card className="mt-8 bg-[var(--color-app-surface-mint)]">
            <div className="flex items-start gap-3">
              <Award size={18} className="text-[#4FFFA0]" />
              <div>
                <h3 className="font-semibold">Next Up</h3>
                <p className="text-sm text-[var(--color-app-text-secondary)]">{badges.find((b) => !b.unlocked)?.name} · {badges.find((b) => !b.unlocked)?.desc}</p>
              </div>
            </div>
          </Card>
        )}
      </SectionContainer>
    </div>
  )
}
