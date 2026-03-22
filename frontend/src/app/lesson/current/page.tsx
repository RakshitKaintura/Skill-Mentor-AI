import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function CurrentLessonPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const { data: roadmap } = await supabase
    .from('roadmaps')
    .select('current_topic, current_phase, current_week')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Current Lesson</h1>
        <div className="mt-6 glass-card p-6">
          <p className="text-xs uppercase tracking-wider text-brand-muted">Now Learning</p>
          <h2 className="mt-2 text-xl font-display font-bold text-brand-text">{roadmap?.current_topic || 'Introduction'}</h2>
          <p className="text-sm text-brand-muted mt-2">
            {roadmap?.current_phase || 'Phase 1'} · Week {roadmap?.current_week || 1}
          </p>
          <p className="text-sm text-brand-muted mt-5">
            Lesson content generation will be connected here in Week 2. For now, this route prevents 404 and keeps navigation working.
          </p>
          <div className="mt-6">
            <Link href="/dashboard" className="text-xs text-brand-blue hover:underline">← Back to Dashboard</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
