import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function LessonsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, topic, completed, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Lessons</h1>
          <Link href="/lesson/current" className="px-4 py-2 rounded-sm bg-brand-green text-brand-bg text-xs font-bold">Start Current Lesson</Link>
        </div>

        <div className="mt-6 space-y-3">
          {lessons && lessons.length > 0 ? (
            lessons.map((lesson: { id: string; topic: string; completed: boolean; created_at: string }) => (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="glass-card p-4 flex items-center justify-between hover:border-brand-muted transition-colors">
                <div>
                  <p className="text-sm font-bold text-brand-text">{lesson.topic}</p>
                  <p className="text-xs text-brand-muted mt-1">{new Date(lesson.created_at).toLocaleString()}</p>
                </div>
                <span className={lesson.completed ? 'text-brand-green text-xs font-bold' : 'text-brand-blue text-xs font-bold'}>
                  {lesson.completed ? 'Completed' : 'Open'}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-brand-muted">No lessons yet.</p>
          )}
        </div>
      </main>
    </div>
  )
}
