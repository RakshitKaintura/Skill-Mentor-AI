import { useState, useCallback, useRef, useEffect } from 'react'
import type { JobReadiness } from '@/types/week4'
import { CareerService } from '@/services/career.service'

export function useCareerReadiness(userId: string | undefined, roadmapId: string, skill: string, level: string, email: string | undefined) {
  const [readiness, setReadiness] = useState<JobReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)
  const [certUrl, setCertUrl] = useState<string | null>(null)
  
  const fetchKeyRef = useRef<string>('')
  const inFlightRef = useRef(false)

  const fetchReadiness = useCallback(async () => {
    if (!userId || !roadmapId) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const data = await CareerService.getJobReadiness(userId, roadmapId)
      if (data.success) setReadiness(data.readiness)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [userId, roadmapId])

  useEffect(() => {
    if (!userId || !skill || !roadmapId) return
    const key = `${userId}|${roadmapId}|${skill}`
    if (fetchKeyRef.current === key || inFlightRef.current) return
    fetchKeyRef.current = key
    void fetchReadiness()
  }, [userId, skill, roadmapId, fetchReadiness])

  const generateCertificate = useCallback(async () => {
    if (!userId || !readiness?.job_ready) return
    setCertLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data: profile } = await sb.from('profiles').select('full_name').eq('id', userId).single()
      const fullName = profile?.full_name || email?.split('@')[0] || 'Student'

      const data = await CareerService.generateCertificate({
          user_id: userId, roadmap_id: roadmapId,
          skill, level, full_name: fullName,
      })
      if (data.success) setCertUrl(data.certificate.pdf_url)
    } finally {
      setCertLoading(false)
    }
  }, [userId, readiness?.job_ready, roadmapId, skill, level, email])

  return { readiness, loading, certLoading, certUrl, generateCertificate }
}
