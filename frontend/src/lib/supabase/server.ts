import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getEnv(): [string, string] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('[Supabase server] missing env vars:', {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? '***redacted***' : undefined,
    })
    throw new Error(
      'Supabase server env requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Verify you have a frontend/.env.local file with those values.'
    )
  }

  return [url, anonKey]
}

/**
 * Creates a Supabase client for Server Components, Actions, and Route Handlers.
 * Uses the latest 2026 async cookie patterns for Next.js 16.
 */
export async function createClient() {
  const [supabaseUrl, supabaseAnonKey] = getEnv()

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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