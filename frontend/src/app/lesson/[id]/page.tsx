import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LessonDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, topic, completed, created_at, steps')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!lesson) notFound()

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">{lesson.topic}</h1>
        <p className="text-xs text-brand-muted mt-2">{lesson.completed ? 'Completed' : 'In progress'} · {new Date(lesson.created_at).toLocaleString()}</p>

        <div className="mt-6 glass-card p-6">
          <p className="text-sm text-brand-muted">
            Detailed lesson rendering is ready for Week 2 lesson-generation output.
          </p>
          <p className="text-sm text-brand-muted mt-2">
            Steps payload saved in database can be rendered here next.
          </p>
          <div className="mt-6">
            <Link href="/lesson" className="text-xs text-brand-blue hover:underline">← Back to all lessons</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
