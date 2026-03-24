'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

/**
 * Custom hook for managing SkillMentor student authentication.
 * Uses the latest 2026 stable auth-refresh patterns.
 */
export function useAuth() {
  // Memoize the client to prevent effect re-runs
  const supabase = useMemo(() => createClient(), [])
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchUser()

    // Listen for auth changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchUser])

  const signOut = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setLoading(false)
  }, [supabase])

  return { 
    user, 
    loading, 
    signOut,
    isAuthenticated: !!user,
    refreshUser: fetchUser
  }
}