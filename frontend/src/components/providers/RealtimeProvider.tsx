'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Rocket, Star, Trophy } from 'lucide-react'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // Get current user to filter notifications
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
      }
    }
    
    getUser()

    // Listen for auth state changes to update user
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUserId(session?.user?.id || null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!userId) return

    // Listen to changes on the user_progress table
    const progressChannel = supabase
      .channel('public:user_progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          const newRec = payload.new as any
          const oldRec = payload.old as any

          // Check if level increased
          if (newRec.current_level && oldRec.current_level && newRec.current_level !== oldRec.current_level) {
            toast.success(`Level Up! You reached level ${newRec.current_level}`, {
              icon: <Rocket className="h-5 w-5 text-indigo-400" />,
              description: 'Keep up the great work!',
              duration: 5000,
            })
          }
          
          // Check if total xp increased significantly (e.g. completed a lesson)
          if (newRec.total_xp && oldRec.total_xp && newRec.total_xp > oldRec.total_xp + 50) {
            toast('Massive XP Gain!', {
              icon: <Star className="h-5 w-5 text-yellow-400" />,
              description: `You earned ${newRec.total_xp - oldRec.total_xp} XP!`,
            })
          }
        }
      )
      .subscribe()

    // Optionally listen to achievements if we have an achievements table
    const achievementsChannel = supabase
      .channel('public:user_achievements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${userId}`
        },
        (_payload: any) => {
          toast.success('New Achievement Unlocked!', {
            icon: <Trophy className="h-5 w-5 text-amber-500" />,
            duration: 6000,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(progressChannel)
      supabase.removeChannel(achievementsChannel)
    }
  }, [userId, supabase])

  return <>{children}</>
}
