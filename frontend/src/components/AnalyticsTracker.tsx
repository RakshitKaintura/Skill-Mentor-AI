'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAnalytics } from '@/hooks/useAnalytics'

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { track } = useAnalytics()
  const lastTrackedRef = useRef<string>('')

  useEffect(() => {
    const query = searchParams.toString()
    const current = query ? `${pathname}?${query}` : pathname
    if (!current || current === lastTrackedRef.current) return

    lastTrackedRef.current = current
    void track('page_view', {
      page: pathname,
      event_data: {
        query,
        url: current,
      },
    })
  }, [pathname, searchParams, track])

  return null
}
