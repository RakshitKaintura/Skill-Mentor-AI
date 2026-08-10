'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DueReview } from '@/types/week3'
import { ProgressService } from '@/services/progress.service'

interface ReviewBannerProps {
  userId:    string
  roadmapId: string
}

export default function ReviewBanner({ userId, roadmapId }: ReviewBannerProps) {
  const router = useRouter()
  const [reviews, setReviews] = useState<DueReview[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    ProgressService.getDueReviews(userId)
      .then(d => setReviews(d.due_reviews || []))
      .catch(() => {})
  }, [userId])

  if (dismissed || reviews.length === 0) return null

  return (
    <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔁</span>
        <div>
          <div className="text-brand-text font-mono text-sm font-medium">
            {reviews.length} topic{reviews.length !== 1 ? 's' : ''} due for review
          </div>
          <div className="text-brand-muted font-mono text-xs">
            Spaced repetition keeps knowledge fresh
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/review?roadmap_id=${roadmapId}`)}
          className="bg-brand-purple text-white px-4 py-2 rounded-lg font-mono text-xs font-bold hover:bg-brand-purple/80 transition-colors"
        >
          Review Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-brand-muted hover:text-brand-text transition-colors p-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}