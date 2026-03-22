'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const toast        = useToast()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const urlError = searchParams.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, full_name')
        .eq('id', data.user.id)
        .single()

      const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
      toast.success(`Welcome back, ${firstName}! 👋`)
      router.push(profile?.onboarding_completed ? '/dashboard' : '/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('Invalid login credentials')) toast.error('Wrong email or password. Please try again.')
      else if (msg.includes('Email not confirmed'))  toast.warning('Please confirm your email first.')
      else if (msg.includes('too many requests'))    toast.error('Too many attempts. Please wait a minute.')
      else if (msg.includes('Failed to fetch'))      toast.error('Unable to reach Supabase. Verify .env.local and your network connectivity.')
      else toast.error(msg || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block font-display font-black text-2xl gradient-text mb-6">
            SkillMentor AI
          </Link>
          <h1 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: '#6B7A99' }}>Your AI teacher is ready to continue</p>
        </div>

        {urlError === 'confirmation_failed' && (
          <div className="mb-5 px-4 py-3 rounded-sm text-xs"
            style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#FF6B6B' }}>
            Email confirmation failed. Please try registering again.
          </div>
        )}

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Email Address</label>
              <input type="email" required placeholder="you@example.com" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-sm"
                style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Password</label>
                <Link href="/auth/forgot-password" className="text-xs hover:underline" style={{ color: '#5B8EFF' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required placeholder="Your password"
                  autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm rounded-sm"
                  style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#6B7A99' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 px-6 py-3.5 rounded-sm font-display font-bold text-sm disabled:opacity-50"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" />Signing in…</>
                : <>Sign In <ArrowRight size={15} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: '#6B7A99' }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-bold" style={{ color: '#4FFFA0' }}>Create one free</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen" />}><LoginForm /></Suspense>
}