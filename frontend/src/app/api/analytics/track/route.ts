import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getBackendApiUrl() {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event_type?: string
      user_id?: string | null
      event_data?: Record<string, unknown>
      page?: string | null
      session_id?: string | null
    }

    if (!body?.event_type || typeof body.event_type !== 'string') {
      return NextResponse.json({ ok: false, detail: 'event_type is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      event_type: body.event_type,
      user_id: user?.id ?? null,
      event_data: body.event_data ?? {},
      page: body.page ?? null,
      session_id: body.session_id ?? null,
    }

    const response = await fetch(`${getBackendApiUrl()}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ ok: false }, { status: 202 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 })
  }
}
