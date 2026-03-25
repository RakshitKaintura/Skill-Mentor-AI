'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import type { DueReview } from '@/types/week3'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function SpacedReviewPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const [reviews, setReviews]   = useState<DueReview[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (user) fetchReviews()
  }, [user])

  const fetchReviews = async () => {
    try {
      const res  = await fetch(`${API}/api/progress/due-reviews/${user?.id}`)
      const data = await res.json()
      setReviews(data.due_reviews || [])
    } finally {
      setLoading(false)
    }
  }

  const startReview = (review: DueReview) => {
    const sp = new URLSearchParams(window.location.search)
    const roadmapId = sp.get('roadmap_id') || ''
    router.push(
      `/quiz/review?topic=${encodeURIComponent(review.topic)}&skill=${encodeURIComponent(review.skill)}&roadmap_id=${roadmapId}&quiz_type=spaced_repetition`
    )
  }

  const intervalLabel = (days: number) => {
    if (days === 1)  return 'New'
    if (days <= 3)   return `${days}d`
    if (days <= 7)   return '1 week'
    if (days <= 14)  return '2 weeks'
    if (days <= 30)  return '1 month'
    return `${days}d`
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-2xl mx-auto px-6 py-10">

        <div className="mb-8">
          <div className="text-xs font-mono text-brand-purple uppercase tracking-widest mb-2">
            Spaced Repetition
          </div>
          <h1 className="font-display font-black text-4xl text-brand-text">Review Queue</h1>
          <p className="text-brand-muted font-mono text-sm mt-2">
            Topics scheduled for review today to strengthen long-term memory
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : reviews.length === 0 ? (
          <div className="bg-brand-surface border border-brand-border rounded-xl p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="font-display font-bold text-xl text-brand-text mb-2">All caught up!</h2>
            <p className="text-brand-muted font-mono text-sm">No reviews due today. Keep completing lessons to build your review queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-brand-muted font-mono text-sm mb-4">
              {reviews.length} topic{reviews.length !== 1 ? 's' : ''} due for review
            </div>
            {reviews.map((r, i) => (
              <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-5 flex items-center justify-between hover:border-brand-purple/40 transition-colors">
                <div>
                  <div className="text-brand-text font-mono text-sm font-medium">{r.topic}</div>
                  <div className="text-brand-muted font-mono text-xs mt-1">
                    {r.skill} · Rep #{r.repetitions} · interval: {intervalLabel(r.interval_days)}
                  </div>
                </div>
                <button
                  onClick={() => startReview(r)}
                  className="bg-brand-purple/10 border border-brand-purple/30 text-brand-purple px-4 py-2 rounded font-mono text-xs hover:bg-brand-purple/20 transition-colors"
                >
                  Review →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}