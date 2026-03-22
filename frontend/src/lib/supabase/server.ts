import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Supabase 服务端] missing env vars:', {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '***redacted***' : undefined,
    })
    throw new Error(
      'Supabase server env requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Verify you have a frontend/.env.local file with those values.'
    )
  }
}

/**
 * Creates a Supabase client for Server Components, Actions, and Route Handlers.
 * Uses the latest 2026 async cookie patterns for Next.js 16.
 */
export async function createClient() {
  assertEnv()

  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // This catch is expected when calling setAll from a Server Component.
          // Server Components cannot set cookies directly; that must happen 
          // via Middleware or Server Actions.
        }
      },
    },
  })
}