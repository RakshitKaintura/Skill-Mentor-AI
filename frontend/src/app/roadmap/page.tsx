import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function RoadmapPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const { data: roadmap } = await supabase
    .from('roadmaps')
    .select('skill, total_weeks, current_week, current_phase, phases')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const phases = (roadmap?.phases as Array<{ name?: string; weeks?: number[]; duration_weeks?: number[]; topics?: string[] }>) ?? []

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-5xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Roadmap</h1>
        {roadmap ? (
          <div className="mt-6 glass-card p-6">
            <p className="text-sm text-brand-muted">
              Learning <span className="text-brand-green font-bold">{roadmap.skill}</span> · Week {roadmap.current_week} of {roadmap.total_weeks}
            </p>
            <div className="mt-5 space-y-3">
              {phases.map((phase, i) => {
                const weeks = phase.duration_weeks ?? phase.weeks ?? []
                const start = weeks[0]
                const end = weeks[weeks.length - 1]
                return (
                  <div key={i} className="border border-brand-border rounded-sm p-4 bg-brand-surface">
                    <p className="font-display font-bold text-brand-text">{phase.name ?? `Phase ${i + 1}`}</p>
                    <p className="text-xs text-brand-muted mt-1">Weeks {start ?? '-'} to {end ?? '-'}</p>
                    <p className="text-xs text-brand-muted mt-2">{phase.topics?.join(', ') || 'Topics will appear here soon.'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-brand-muted">No roadmap found yet. Complete onboarding to generate one.</p>
        )}
      </main>
    </div>
  )
}
