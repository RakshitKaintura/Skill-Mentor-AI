'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const toast    = useToast()

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email)) { toast.error('Enter a valid email address'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block font-display font-black text-2xl gradient-text mb-6">
            SkillMentor AI
          </Link>
          <h1 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
            {sent ? 'Email sent!' : 'Reset password'}
          </h1>
          <p className="text-sm" style={{ color: '#6B7A99' }}>
            {sent ? `Check ${email} for your reset link` : "We'll send a password reset link to your email"}
          </p>
        </div>

        {!sent ? (
          <div className="glass-card p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#6B7A99' }} />
                  <input type="email" required placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-sm"
                    style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center gap-2 py-3.5 rounded-sm font-display font-bold text-sm disabled:opacity-50"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
                {loading ? <><Loader2 size={15} className="animate-spin" />Sending…</> : 'Send Reset Link'}
              </button>
            </form>
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <CheckCircle size={40} className="mx-auto mb-4" style={{ color: '#4FFFA0' }} />
            <p className="text-sm mb-6 leading-relaxed" style={{ color: '#6B7A99' }}>
              If an account exists for this email, you&apos;ll receive a reset link shortly.
            </p>
            <button onClick={() => setSent(false)} className="text-sm underline" style={{ color: '#5B8EFF' }}>
              Try a different email
            </button>
          </div>
        )}

        <div className="text-center mt-6">
          <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm hover:underline"
            style={{ color: '#6B7A99' }}>
            <ArrowLeft size={13} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}