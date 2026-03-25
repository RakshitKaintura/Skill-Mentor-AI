'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import type { LeaderboardEntry } from '@/types/week3'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function LeaderboardPage() {
  const { user }  = useAuth()
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchLeaderboard() }, [])

  const fetchLeaderboard = async () => {
    try {
      const res  = await fetch(`${API}/api/progress/leaderboard?limit=50`)
      const data = await res.json()
      setEntries(data.leaderboard || [])
    } finally {
      setLoading(false)
    }
  }

  const rankColor = (rank: number) => {
    if (rank === 1) return 'text-brand-yellow'
    if (rank === 2) return 'text-brand-muted'
    if (rank === 3) return 'text-brand-red'
    return 'text-brand-muted'
  }

  const rankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">Global Rankings</div>
          <h1 className="font-display font-black text-4xl text-brand-text">Leaderboard</h1>
          <p className="text-brand-muted font-mono text-sm mt-2">Top learners ranked by XP points</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const isMe = entry.id === user?.id
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    isMe
                      ? 'border-brand-green/40 bg-brand-green/5'
                      : 'border-brand-border bg-brand-surface hover:border-brand-border/80'
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-10 text-center font-display font-black text-lg ${rankColor(entry.rank)}`}>
                    {rankEmoji(entry.rank)}
                  </div>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isMe ? 'bg-brand-green text-brand-bg' : 'bg-brand-surface border border-brand-border text-brand-text'
                  }`}>
                    {entry.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm font-medium truncate ${isMe ? 'text-brand-green' : 'text-brand-text'}`}>
                        {entry.full_name}
                      </span>
                      {isMe && <span className="text-xs font-mono text-brand-green bg-brand-green/10 px-2 py-0.5 rounded">You</span>}
                    </div>
                    <div className="text-brand-muted font-mono text-xs truncate">
                      {entry.current_skill || 'Learning…'} · {entry.streak_days}🔥 · {entry.lessons_completed} lessons
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right flex-shrink-0">
                    <div className={`font-display font-black text-lg ${isMe ? 'text-brand-green' : 'text-brand-yellow'}`}>
                      {entry.xp_points.toLocaleString()}
                    </div>
                    <div className="text-brand-muted font-mono text-xs">XP</div>
                  </div>
                </div>
              )
            })}

            {entries.length === 0 && (
              <div className="text-center py-20">
                <p className="text-brand-muted font-mono text-sm">No entries yet. Start learning to appear here!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}