import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 Proxy Middleware
 * Optimized to prevent "JSON Payload Dumps" by bypassing background data fetches.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. CRITICAL: Bypass internal Next.js traffic & API calls
  // This prevents the middleware from intercepting RSC/Data fetches 
  // which causes the raw JSON text dump on the screen.
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/v1') ||
    pathname.includes('.') ||
    request.headers.get('accept')?.includes('text/x-component') || 
    request.headers.get('x-nextjs-data')
  ) {
    return NextResponse.next()
  }

  // 2. Initialize the standard response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 3. Supabase SSR Client setup
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies for local use in this request
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          // Re-instantiate response to sync headers
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          // Set cookies on the final response for the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 4. Secure Session Check
  const { data: { session } } = await supabase.auth.getSession()

  // 5. App Route Protection
  const protectedPaths = ['/dashboard', '/onboarding', '/roadmap', '/lesson']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', request.url)
    // Optional: loginUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 6. Prevent logged-in users from hitting Auth pages (Register/Login)
  if (pathname.startsWith('/auth') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones provided below:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}