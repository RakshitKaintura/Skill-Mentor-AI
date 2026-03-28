import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getBackendApiUrl() {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    const allowed = getAdminEmails()
    if (allowed.length > 0) {
      const email = user.email?.toLowerCase() || ''
      if (!allowed.includes(email)) {
        return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
      }
    }

    const adminKey = process.env.ADMIN_API_KEY
    if (!adminKey) {
      return NextResponse.json({ detail: 'ADMIN_API_KEY missing in frontend env' }, { status: 500 })
    }

    const response = await fetch(`${getBackendApiUrl()}/api/admin/stats`, {
      headers: { 'x-admin-key': adminKey },
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ detail: 'Admin proxy failed' }, { status: 500 })
  }
}
