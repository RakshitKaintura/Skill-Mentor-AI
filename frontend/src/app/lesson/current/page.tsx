import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LessonViewer } from './LessonViewer'

/**
 * Server Component: CurrentLessonPage
 * Orchestrates data fetching for the active lesson session.
 * Ensures the user is authenticated, onboarded, and has an active roadmap.
 */
export default async function CurrentLessonPage() {
  const supabase = await createClient()

  // 1. Authenticate User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Verify Onboarding Status & Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  // 3. Retrieve Latest Active Roadmap
  const { data: roadmap } = await supabase
    .from('roadmaps')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!roadmap) {
    redirect('/onboarding')
  }

  // 4. Check for an Existing Incomplete Lesson for this Topic
  // This prevents re-generating (and wasting API tokens) if the user refreshes
  const { data: existingLesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('user_id', user.id)
    .eq('topic', roadmap.current_topic)
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-brand-bg">
      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* LessonViewer is a Client Component that handles:
          - Calling the /api/lesson/generate endpoint
            - Rendering the 6-step lesson content
            - Handling PDF generation and Doubt Solving
        */}
        <LessonViewer
          roadmapId={roadmap.id}
          topic={roadmap.current_topic ?? roadmap.skill}
          skill={roadmap.skill}
          level={roadmap.level}
          phaseName={roadmap.current_phase ?? 'Foundations'}
          weekNumber={roadmap.current_week ?? 1}
          existingLessonId={existingLesson?.id ?? null}
          userName={profile.full_name ?? 'Learner'}
        />
      </main>
    </div>
  )
}