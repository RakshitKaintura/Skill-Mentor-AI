import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function ProgressPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', user.id).single()

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} streakDays={progress?.streak_days ?? 0} xpPoints={progress?.xp_points ?? 0} />
      <main className="max-w-5xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Progress</h1>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <p className="text-xs text-brand-muted uppercase tracking-wider">XP Points</p>
            <p className="text-3xl font-display font-black text-brand-purple mt-2">{progress?.xp_points ?? 0}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-brand-muted uppercase tracking-wider">Lessons Completed</p>
            <p className="text-3xl font-display font-black text-brand-green mt-2">{progress?.lessons_completed ?? 0}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-brand-muted uppercase tracking-wider">Study Minutes</p>
            <p className="text-3xl font-display font-black text-brand-blue mt-2">{progress?.total_study_minutes ?? 0}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
