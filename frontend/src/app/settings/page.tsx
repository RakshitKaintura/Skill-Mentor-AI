'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { Settings, User, Bell, Shield, LogOut, Loader2, Save, Trash2 } from 'lucide-react'

export default function SettingsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const toast    = useToast()
  const { user, loading: authLoading } = useAuth()

  const [profile, setProfile]       = useState({ full_name: '', email: '', current_skill: '' })
  const [saving, setSaving]         = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [progress, setProgress]     = useState<{ streak_days: number; xp_points: number } | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ data: p }, { data: prog }] = await Promise.all([
        supabase.from('profiles').select('full_name, email, current_skill').eq('id', user.id).single(),
        supabase.from('user_progress').select('streak_days, xp_points').eq('user_id', user.id).single(),
      ])
      if (p) setProfile({ full_name: p.full_name ?? '', email: p.email ?? user.email ?? '', current_skill: p.current_skill ?? '' })
      if (prog) setProgress(prog)
    }
    load()
  }, [user, supabase])

  const handleSave = async () => {
    if (!user || !profile.full_name.trim()) { toast.error('Name cannot be empty'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles')
        .update({ full_name: profile.full_name.trim() })
        .eq('id', user.id)
      if (error) throw error
      toast.success('Profile updated!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleDeleteAccount = async () => {
    if (confirmDelete !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    setDeleting(true)
    toast.error('Account deletion requires contacting support. Email: support@skillmentor.ai')
    setDeleting(false)
    setConfirmDelete('')
  }

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="animate-spin" style={{ color: '#4FFFA0' }} />
    </div>
  )

  return (
    <div className="min-h-screen">
      <DashboardNavbar
        userName={profile.full_name}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={progress?.xp_points ?? 0}
      />

      <div className="max-w-2xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={16} style={{ color: '#6B7A99' }} />
            <span className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Settings</span>
          </div>
          <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>
            Account Settings
          </h1>
        </div>

        {/* Profile */}
        <div className="glass-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User size={15} style={{ color: '#4FFFA0' }} />
            <h2 className="font-display font-bold text-sm">Profile</h2>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-black text-2xl"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
              {profile.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <p className="font-display font-bold text-sm">{profile.full_name || 'Your Name'}</p>
              <p className="text-xs" style={{ color: '#6B7A99' }}>{profile.email}</p>
              {profile.current_skill && (
                <p className="text-xs mt-0.5" style={{ color: '#4FFFA0' }}>
                  Learning: {profile.current_skill}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                className="w-full px-4 py-3 text-sm rounded-sm"
                style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-3 text-sm rounded-sm opacity-50 cursor-not-allowed"
                style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
              />
              <p className="text-xs" style={{ color: '#6B7A99' }}>Email cannot be changed after signup</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="self-start flex items-center gap-2 px-5 py-3 rounded-sm font-display font-bold text-sm disabled:opacity-50"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Learning preferences */}
        <div className="glass-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={15} style={{ color: '#5B8EFF' }} />
            <h2 className="font-display font-bold text-sm">Learning Preferences</h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Daily study reminder',     desc: 'Get reminded to study every day',           defaultOn: true  },
              { label: 'Lesson completion alerts', desc: 'Celebrate when you finish a lesson',         defaultOn: true  },
              { label: 'Streak notifications',     desc: "Don't break your streak — reminders at night", defaultOn: true  },
              { label: 'Weekly progress summary',  desc: 'Weekly email with your learning stats',      defaultOn: false },
            ].map(pref => (
              <div key={pref.label} className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                style={{ borderColor: '#1E2A42' }}>
                <div>
                  <p className="text-sm font-display font-bold">{pref.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>{pref.desc}</p>
                </div>
                <button
                  className="w-11 h-6 rounded-full relative transition-colors"
                  style={{ background: pref.defaultOn ? '#4FFFA0' : '#1E2A42' }}>
                  <div className="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform"
                    style={{
                      background: pref.defaultOn ? '#080B14' : '#6B7A99',
                      transform:  pref.defaultOn ? 'translateX(20px)' : 'translateX(0)',
                    }} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: '#3A4A6A' }}>
            Note: Notification settings are saved locally. Push notification system coming in Week 3.
          </p>
        </div>

        {/* Account actions */}
        <div className="glass-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={15} style={{ color: '#FFD166' }} />
            <h2 className="font-display font-bold text-sm">Account</h2>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-sm" style={{ background: '#141B2D', border: '1px solid #1E2A42' }}>
              <div>
                <p className="text-sm font-display font-bold">Change Password</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>Send a password reset email</p>
              </div>
              <button
                onClick={async () => {
                  if (!user?.email) return
                  await supabase.auth.resetPasswordForEmail(user.email)
                  toast.success('Password reset email sent!')
                }}
                className="px-4 py-2 rounded-sm text-xs font-bold border transition-colors"
                style={{ borderColor: '#1E2A42', color: '#E8EDF8' }}>
                Send Email
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-sm" style={{ background: '#141B2D', border: '1px solid #1E2A42' }}>
              <div>
                <p className="text-sm font-display font-bold">Sign Out</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>Sign out of all devices</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold border disabled:opacity-50 transition-colors"
                style={{ borderColor: 'rgba(255,107,107,0.4)', color: '#FF6B6B', background: 'rgba(255,107,107,0.08)' }}>
                {loggingOut ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="glass-card p-6" style={{ borderColor: 'rgba(255,107,107,0.2)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={15} style={{ color: '#FF6B6B' }} />
            <h2 className="font-display font-bold text-sm" style={{ color: '#FF6B6B' }}>Danger Zone</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: '#6B7A99' }}>
            Deleting your account is permanent. All your roadmaps, lessons, and progress will be lost forever.
          </p>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="w-full px-4 py-3 text-sm rounded-sm"
              style={{ background: '#141B2D', borderColor: 'rgba(255,107,107,0.3)', color: '#E8EDF8' }}
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || confirmDelete !== 'DELETE'}
              className="self-start flex items-center gap-2 px-5 py-3 rounded-sm font-display font-bold text-sm disabled:opacity-30 transition-opacity"
              style={{ background: 'rgba(255,107,107,0.15)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.4)' }}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
