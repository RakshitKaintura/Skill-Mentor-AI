import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function AchievementsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: progress } = await supabase.from('user_progress').select('badges_earned').eq('user_id', user.id).single()

  const badges = (progress?.badges_earned as string[]) ?? []

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-5xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Achievements</h1>
        {badges.length > 0 ? (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge, i) => (
              <div key={`${badge}-${i}`} className="glass-card p-5">
                <p className="text-sm font-display font-bold text-brand-text">{badge}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-brand-muted">No badges yet. Complete lessons and quizzes to unlock achievements.</p>
        )}
      </main>
    </div>
  )
}
