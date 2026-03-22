import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar userName={profile?.full_name ?? ''} />
      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display font-black text-3xl text-brand-text tracking-tight">Settings</h1>
        <div className="mt-6 glass-card p-6 space-y-3">
          <div>
            <p className="text-xs text-brand-muted uppercase tracking-wider">Full Name</p>
            <p className="text-sm text-brand-text mt-1">{profile?.full_name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-brand-muted uppercase tracking-wider">Email</p>
            <p className="text-sm text-brand-text mt-1">{profile?.email || user.email || 'Not set'}</p>
          </div>
          <p className="text-xs text-brand-muted">Profile editing can be added in Week 2.</p>
        </div>
      </main>
    </div>
  )
}
