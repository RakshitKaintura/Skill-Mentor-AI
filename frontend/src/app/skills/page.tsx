import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, CalendarDays, ArrowRight, Target, Layers, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import { DeleteSkillButton } from '@/components/skills/DeleteSkillButton'
import type { Roadmap, UserProgress } from '@/types'

const GOAL_LABEL: Record<string, string> = {
  get_job: 'Get a job',
  freelance: 'Freelance work',
  build_project: 'Build a project',
  exam: 'Exam prep',
  upskill: 'Upskill',
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

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

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={progress?.xp_points ?? 0}
      />

      <SectionContainer className="py-8 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-app-primary)]">
              <BookOpen size={14} />
              Skills Library
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Your Learning Skills</h1>
            <p className="mt-2 text-sm text-[var(--color-app-text-secondary)]">
              All skills are sorted by roadmap creation date. Pick any skill and continue exactly where you left off.
            </p>
          </div>
          <Link href="/onboarding?mode=new-skill" className={buttonClassName()}>
            <Plus size={14} />
            Create New Skill
          </Link>
        </div>

        {roadmapList.length === 0 ? (
          <Card className="bg-[var(--color-app-surface-cool)] text-center">
            <BookOpen size={28} className="mx-auto mb-3 text-[var(--color-app-text-secondary)]" />
            <h2 className="text-lg font-semibold">No skills yet</h2>
            <p className="mt-2 text-sm text-[var(--color-app-text-secondary)]">
              Generate your first roadmap to start learning.
            </p>
            <div className="mt-5">
              <Link href="/onboarding" className={buttonClassName()}>
                Create First Roadmap <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roadmapList.map((roadmap) => {
              const totalWeeks = Math.max(1, roadmap.total_duration ?? roadmap.total_weeks ?? 12)
              const currentWeek = roadmap.current_week ?? 1
              const completedWeeks = Math.max(0, currentWeek - 1)
              const progressPercent = Math.round((completedWeeks / totalWeeks) * 100)

              return (
                <Card key={roadmap.id} className="bg-[var(--color-app-surface)]">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-app-text-primary)]">{roadmap.skill}</h2>
                      <p className="text-sm text-[var(--color-app-text-secondary)]">
                        {roadmap.level} · {GOAL_LABEL[roadmap.goal] ?? roadmap.goal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--color-app-surface-cool)] px-2.5 py-1 text-xs font-semibold text-[var(--color-app-primary)]">
                        Week {currentWeek}/{totalWeeks}
                      </span>
                      <DeleteSkillButton roadmapId={roadmap.id} skillName={roadmap.skill} />
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-3 text-xs text-[var(--color-app-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={13} />
                      Created {formatDate(roadmap.created_at)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers size={13} />
                      {Array.isArray(roadmap.phases) ? roadmap.phases.length : 0} phases
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Target size={13} />
                      Current topic: {roadmap.current_topic ?? roadmap.skill}
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-app-text-secondary)]">
                      <span>Progress</span>
                      <span className="font-semibold text-[var(--color-app-primary)]">{progressPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-app-bg)]">
                      <div
                        className="h-2 rounded-full bg-[var(--color-app-primary)] transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/lesson/current?roadmap_id=${encodeURIComponent(roadmap.id)}`}
                      className={buttonClassName()}
                    >
                      Continue Skill <ArrowRight size={14} />
                    </Link>
                    <Link
                      href="/roadmap"
                      className={buttonClassName({ variant: 'secondary' })}
                    >
                      View Roadmap
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </SectionContainer>
    </div>
  )
}
