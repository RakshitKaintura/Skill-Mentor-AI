import Link                from 'next/link'
import { redirect }        from 'next/navigation'
import { BookOpen, Plus }  from 'lucide-react'
import { createClient }    from '@/lib/supabase/server'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import SectionContainer    from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import { SkillsLibrary }   from '@/components/skills/SkillsLibrary'
import type { SkillStat }  from '@/components/skills/SkillsLibrary'
import type { Roadmap, UserProgress } from '@/types'

export default async function SkillsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)
    .single() as unknown as { data: UserProgress | null }

  const { data: roadmaps } = await supabase
    .from('roadmaps')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: Roadmap[] | null }

  const roadmapList = roadmaps ?? []

  // ── NEW: Per-roadmap lesson + quiz stats (parallel) ─────────
  const [{ data: lessonStats }, { data: quizStats }] = await Promise.all([
    supabase
      .from('lessons')
      .select('roadmap_id, completed')
      .eq('user_id', user.id),
    supabase
      .from('quizzes')
      .select('roadmap_id, score, total_questions, completed')
      .eq('user_id', user.id)
      .eq('completed', true),
  ])

  // ── Build enriched SkillStat objects ─────────────────────────
  const skillStats: SkillStat[] = roadmapList.map(roadmap => {
    const rdLessons = (lessonStats ?? []).filter(
      (l: { roadmap_id: string; completed: boolean }) => l.roadmap_id === roadmap.id
    )
    const rdQuizzes = (quizStats ?? []).filter(
      (q: { roadmap_id: string; score: number; total_questions: number; completed: boolean }) =>
        q.roadmap_id === roadmap.id
    )

    const lessonsCompleted = rdLessons.filter(
      (l: { completed: boolean }) => l.completed
    ).length

    const avgQuizScore = rdQuizzes.length > 0
      ? Math.round(
          rdQuizzes.reduce(
            (s: number, q: { score: number; total_questions: number }) =>
              s + (q.total_questions > 0
                ? (q.score / q.total_questions) * 100
                : Math.min(100, q.score)),
            0
          ) / rdQuizzes.length
        )
      : 0

    const totalWeeks      = Math.max(1, roadmap.total_duration ?? roadmap.total_weeks ?? 12)
    const currentWeek     = roadmap.current_week ?? 1
    const progressPercent = Math.round((Math.max(0, currentWeek - 1) / totalWeeks) * 100)

    return {
      roadmapId:        roadmap.id,
      skill:            roadmap.skill,
      level:            roadmap.level,
      goal:             roadmap.goal,
      totalWeeks,
      currentWeek,
      progressPercent,
      phasesCount:      Array.isArray(roadmap.phases) ? roadmap.phases.length : 0,
      currentTopic:     roadmap.current_topic ?? roadmap.skill,
      createdAt:        roadmap.created_at,
      lessonsCompleted,
      quizzesDone:      rdQuizzes.length,
      avgQuizScore,
      xpEstimate:       lessonsCompleted * 100 + rdQuizzes.length * 50,
    }
  })

  const totalXp = progress?.xp_points ?? 0

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={totalXp}
      />

      <SectionContainer className="py-8 md:py-10">
        {/* Page header — server-rendered, always visible */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-app-primary)]">
              <BookOpen size={14} />
              Skills Library
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Your Learning Skills
            </h1>
            <p className="mt-2 text-sm text-[var(--color-app-text-secondary)]">
              All skills sorted by creation date.{' '}
              {skillStats.length >= 2
                ? 'Switch to Compare view to analyse progress across skills.'
                : 'Pick any skill and continue exactly where you left off.'}
            </p>
          </div>
          <Link href="/onboarding?mode=new-skill" className={buttonClassName()}>
            <Plus size={14} /> Create New Skill
          </Link>
        </div>

        {/* Client wrapper — owns Library ↔ Compare toggle */}
        <SkillsLibrary skills={skillStats} totalXp={totalXp} />
      </SectionContainer>
    </div>
  )
}
