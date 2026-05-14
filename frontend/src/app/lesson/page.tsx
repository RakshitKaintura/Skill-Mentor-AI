import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { BookOpen, CheckCircle, ArrowRight, Play } from 'lucide-react'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import { PageTransition } from '@/components/ui/PageTransition'

export default async function LessonsListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', user.id).single()

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, topic, week_number, completed, completed_at, created_at, key_takeaway, sources_used')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)

  const { data: roadmap } = await supabase
    .from('roadmaps').select('skill, current_topic').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).single()

  const total     = lessons?.length ?? 0
  const completed = lessons?.filter((l: { completed: boolean }) => l.completed).length ?? 0

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0} xpPoints={progress?.xp_points ?? 0} />

      <PageTransition>
      <SectionContainer className="py-8 md:py-10">

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-[var(--color-app-primary)]" />
              <span className="text-sm text-[var(--color-app-primary)]">All Lessons</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Your Lessons</h1>
            <p className="mt-2 text-base text-[var(--color-app-text-secondary)]">{completed}/{total} completed · {roadmap?.skill}</p>
          </div>
          <Link href="/lesson/current"
            className={buttonClassName()}>
            <Play size={14} /> Next Lesson
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: 'Total Lessons',  value: total },
            { label: 'Completed',      value: completed },
            { label: 'Completion Rate',value: total > 0 ? `${Math.round(completed/total*100)}%` : '0%' },
          ].map(({ label, value }) => (
            <Card key={label} className="text-center bg-[var(--color-app-surface-cool)]">
              <div className="mb-1 text-3xl font-semibold text-[var(--color-app-text-primary)]">{value}</div>
              <div className="text-xs text-[var(--color-app-text-secondary)]">{label}</div>
            </Card>
          ))}
        </div>

        {/* List */}
        {!lessons || lessons.length === 0 ? (
          <Card className="p-16 text-center bg-[var(--color-app-surface-warm)]">
            <BookOpen size={40} className="mx-auto mb-4 text-[var(--color-app-text-secondary)]" />
            <h3 className="mb-2 text-xl font-semibold">No lessons yet</h3>
            <p className="mb-6 text-base text-[var(--color-app-text-secondary)]">Generate your first lesson to start learning {roadmap?.skill}</p>
            <Link href="/lesson/current"
              className={buttonClassName()}>
              Start First Lesson <ArrowRight size={14} />
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {roadmap?.current_topic && (
              <Link href="/lesson/current"
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface-mint)] p-6 shadow-sm transition-colors hover:bg-[var(--color-app-surface)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d2e3fc] bg-[#e8f0fe]">
                    <Play size={16} className="text-[var(--color-app-primary)]" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-app-primary)]">UP NEXT</span>
                    <p className="text-sm font-semibold">{roadmap.current_topic}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-[var(--color-app-primary)]" />
              </Link>
            )}
            {lessons.map((lesson: {
              id: string; topic: string; week_number: number;
              completed: boolean; created_at: string; key_takeaway: string | null;
            }) => (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface-cool)] p-6 shadow-sm transition-colors hover:bg-[var(--color-app-surface)]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={lesson.completed
                    ? 'flex h-10 w-10 items-center justify-center rounded-full border border-[#ceead6] bg-[#e6f4ea] text-[#188038]'
                    : 'flex h-10 w-10 items-center justify-center rounded-full border border-[#d2e3fc] bg-[#e8f0fe] text-[var(--color-app-primary)]'}>
                    {lesson.completed ? <CheckCircle size={16} /> : <BookOpen size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lesson.topic}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-[var(--color-app-text-secondary)]">Week {lesson.week_number}</span>
                      {lesson.key_takeaway && (
                        <span className="max-w-56 truncate text-xs text-[var(--color-app-text-secondary)]">
                          {lesson.key_takeaway}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lesson.completed && (
                    <span className="rounded bg-[#e6f4ea] px-2 py-1 text-xs text-[#188038]">
                      Done
                    </span>
                  )}
                  <ArrowRight size={14} className="text-[var(--color-app-text-secondary)]" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionContainer>
      </PageTransition>
    </div>
  )
}