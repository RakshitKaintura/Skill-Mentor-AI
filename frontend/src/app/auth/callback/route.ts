import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * OAuth/Email Confirmation Callback Handler
 * Standard Next.js 16 pattern for exchanging PKCE codes for sessions.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Default to dashboard, but allow a 'next' parameter for deep linking
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    
    // Exchange the temporary PKCE code for a persistent session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // check for proxy headers
      const isLocalDevelopment = process.env.NODE_ENV === 'development'
      
      if (isLocalDevelopment) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // If exchange fails, return student to login with an error message
  return NextResponse.redirect(`${origin}/auth/login?error=Authentication failed. Please try again.`)
}