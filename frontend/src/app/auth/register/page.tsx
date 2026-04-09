'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()
  const toast    = useToast()

  const [form, setForm]           = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [emailSent, setEmailSent] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds(s => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  const set = (key: string, val: string) => {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())                  e.name     = 'Name is required'
    if (!/\S+@\S+\.\S+/.test(form.email))  e.email    = 'Enter a valid email'
    if (form.password.length < 8)           e.password = 'Minimum 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const strengthLevel = !form.password ? 0
    : form.password.length < 8  ? 1
    : form.password.length < 12 ? 2
    : /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4 : 3

  const strengthMeta = [
    { label: '',         color: '#1E2A42' },
    { label: 'Too short',color: '#FF6B6B' },
    { label: 'Weak',     color: '#FF8C42' },
    { label: 'Good',     color: '#FFD166' },
    { label: 'Strong',   color: '#4FFFA0' },
  ][strengthLevel]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cooldownSeconds > 0) {
      toast.warning(`Please wait ${cooldownSeconds}s before trying again.`)
      return
    }
    if (!validate()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error

      // Email confirmation flow: Supabase returns a user but no active session.
      // Show confirmation UI immediately and do not block on profile writes.
      if (data.user && !data.session) {
        setEmailSent(true)
        return
      }

      if (data.user && data.session) {
        const { error: pe } = await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            full_name: form.name,
            email: form.email,
            onboarding_completed: false,
          },
          { onConflict: 'id' }
        )
        if (pe && pe.code !== '23505') throw pe

        toast.success('Account created! Setting up your learning path…')
        router.push('/onboarding')
        return
      }

      setEmailSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.includes('already registered')) {
        toast.error('An account with this email already exists.')
      } else if (msg.includes('security purposes') || msg.includes('after') && msg.includes('seconds')) {
        const match = msg.match(/after\s+(\d+)\s+seconds/i)
        const wait = Number(match?.[1] ?? 60)
        setCooldownSeconds(Number.isFinite(wait) ? wait : 60)
        toast.warning(`Too many attempts. Try again in ${Number.isFinite(wait) ? wait : 60}s.`)
      } else if (msg.toLowerCase().includes('rate limit')) {
        setCooldownSeconds(60)
        toast.warning('Email rate limit exceeded. Please wait about 60s before trying again.')
      } else if (msg.includes('Failed to fetch')) {
        toast.error('Unable to reach Supabase. Verify .env.local values and network connectivity.')
      } else {
        toast.error(msg || 'Unable to create account right now. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center animate-fade-up">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(79,255,160,0.1)', border: '1px solid rgba(79,255,160,0.3)' }}>
          <CheckCircle size={32} style={{ color: '#4FFFA0' }} />
        </div>
        <h1 className="font-display font-black text-3xl mb-3" style={{ letterSpacing: '-1px' }}>
          Check your email
        </h1>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: '#6B7A99' }}>
          We sent a confirmation link to{' '}
          <span style={{ color: '#E8EDF8', fontWeight: 600 }}>{form.email}</span>.
          Click it to activate your account.
        </p>
        <button onClick={() => setEmailSent(false)} className="text-sm underline" style={{ color: '#5B8EFF' }}>
          Use a different email
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block font-display font-black text-2xl gradient-text mb-6">
            SkillMentor AI
          </Link>
          <h1 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
            Create your account
          </h1>
          <p className="text-sm" style={{ color: '#6B7A99' }}>Your AI teacher is waiting</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Full Name</label>
              <input type="text" required placeholder="Your full name"
                value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-sm"
                style={{ background: '#141B2D', borderColor: errors.name ? '#FF6B6B' : '#1E2A42', color: '#E8EDF8' }}
              />
              {errors.name && <p className="text-xs" style={{ color: '#FF6B6B' }}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Email Address</label>
              <input type="email" required placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-sm"
                style={{ background: '#141B2D', borderColor: errors.email ? '#FF6B6B' : '#1E2A42', color: '#E8EDF8' }}
              />
              {errors.email && <p className="text-xs" style={{ color: '#FF6B6B' }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required minLength={8}
                  placeholder="Min 8 characters"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm rounded-sm"
                  style={{ background: '#141B2D', borderColor: errors.password ? '#FF6B6B' : '#1E2A42', color: '#E8EDF8' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#6B7A99' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs" style={{ color: '#FF6B6B' }}>{errors.password}</p>}
              {form.password && (
                <div>
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-300"
                        style={{ background: i <= strengthLevel ? strengthMeta.color : '#1E2A42' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strengthMeta.color }}>{strengthMeta.label}</p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || cooldownSeconds > 0}
              className="mt-2 flex items-center justify-center gap-2 px-6 py-3.5 rounded-sm font-display font-bold text-sm disabled:opacity-50"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" />Creating account…</>
                : cooldownSeconds > 0
                  ? <>Wait {cooldownSeconds}s <Loader2 size={15} className="animate-spin" /></>
                  : <>Create Account <ArrowRight size={15} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: '#6B7A99' }}>
          Already have an account?{' '}
          <Link href="/auth/login" className="font-bold" style={{ color: '#4FFFA0' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}