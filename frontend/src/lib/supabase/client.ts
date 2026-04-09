import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function getEnv(): [string, string] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('[Supabase client] missing env vars:', {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? '***redacted***' : undefined,
    })
    throw new Error(
      'Supabase client env requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Verify you have a frontend/.env.local file with those values and restart Next.js.'
    )
  }

  return [url, anonKey]
}

/**
 * Creates a Supabase client for use in Client Components.
 * This client automatically handles session persistence using document.cookie.
 */
export function createClient() {
  if (browserClient) return browserClient

  const [supabaseUrl, supabaseAnonKey] = getEnv()

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return browserClient
}