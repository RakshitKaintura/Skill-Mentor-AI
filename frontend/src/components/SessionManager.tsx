'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LessonService } from '@/services/lesson.service'

/**
 * SessionManager ensures that any generated lessons are deleted when the user
 * starts a new browser session, achieving the "ephemeral lessons" requirement.
 */
export function SessionManager() {
  useEffect(() => {
    const supabase = createClient()
    
    const cleanupLessonsForUser = async (userId: string) => {
      try {
        await LessonService.cleanupLessons(userId)
        console.log('Cleaned up previous session lessons.')
      } catch (e) {
        console.error('Failed to cleanup session lessons:', e)
      }
    }

    const checkAndInitSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const cookieName = `sm_session_${user.id}`
      const hasSession = document.cookie.split('; ').find(row => row.startsWith(`${cookieName}=`))
      
      if (!hasSession) {
        // No session cookie exists -> fresh browser session.
        // Set a session cookie (no expiration date means it dies when the browser closes).
        document.cookie = `${cookieName}=true; path=/;`
        await cleanupLessonsForUser(user.id)
      }
    }
    
    // 1. Check on initial app load
    checkAndInitSession()
    
    // 2. Listen for explicit logins in this same tab
    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        const cookieName = `sm_session_${user.id}`
        const hasSession = document.cookie.split('; ').find(row => row.startsWith(`${cookieName}=`))
        
        if (!hasSession) {
          document.cookie = `${cookieName}=true; path=/;`
          cleanupLessonsForUser(user.id)
        }
      }
    })
    
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])
  
  return null
}
