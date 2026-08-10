import { useState, useCallback } from 'react'
import { CareerService } from '@/services/career.service'

export type ResumeReviewResponse = {
  ats_score?: number
  verdict?: string
  missing_keywords?: string[]
  critique?: Array<{ section?: string; issue?: string; fix?: string }>
  top_improvement?: string
}

export function useResumeReview(userId: string | undefined, roadmapId: string, skill: string) {
  const [targetRole, setTargetRole] = useState('Software Engineer')
  const [resumeText, setResumeText] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<ResumeReviewResponse | null>(null)
  const [error, setError] = useState('')

  const submitResume = useCallback(async () => {
    if (!userId || !roadmapId || !skill || !resumeText.trim()) return
    setReviewing(true)
    setError('')
    try {
      const data = await CareerService.reviewResume({
          user_id: userId,
          roadmap_id: roadmapId,
          skill,
          target_role: targetRole,
          resume_text: resumeText,
      })
      if (data.success) setReview(data.review)
      else setError(data.error || 'Review failed. Please try again.')
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setReviewing(false)
    }
  }, [userId, roadmapId, skill, targetRole, resumeText])

  return { targetRole, setTargetRole, resumeText, setResumeText, reviewing, review, error, submitResume }
}
