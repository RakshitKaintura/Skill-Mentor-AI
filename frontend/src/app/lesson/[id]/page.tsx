import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LessonViewer } from '@/app/lesson/current/LessonViewer'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'

interface Props { params: Promise<{ id: string }> }

export default async function LessonByIdPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: progress } = await supabase
    .from('user_progress')
    .select('streak_days, xp_points')
    .eq('user_id', user.id)
    .single()

  const { data: lesson } = await supabase
    .from('lessons').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!lesson) notFound()

  const { data: roadmap } = await supabase
    .from('roadmaps').select('id, skill, level, current_phase, current_week')
    .eq('id', lesson.roadmap_id).single()

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={progress?.xp_points ?? 0}
      />
      <SectionContainer className="py-8">
        <LessonViewer
          roadmapId={roadmap?.id ?? ''}
          topic={lesson.topic}
          skill={roadmap?.skill ?? ''}
          level={roadmap?.level ?? 'beginner'}
          phaseName={roadmap?.current_phase ?? 'Foundations'}
          weekNumber={lesson.week_number ?? 1}
          existingLessonId={id}
          userName={profile?.full_name ?? 'Learner'}
        />
      </SectionContainer>
    </div>
  )
}