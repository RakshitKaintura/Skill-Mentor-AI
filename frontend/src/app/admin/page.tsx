'use client'

import { useEffect, useState } from 'react'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'

type DashboardStats = {
  total_users: number
  new_users_week: number
  total_lessons: number
  total_quizzes: number
  total_xp: number
  avg_streak: number
  certs_issued: number
  interviews_done: number
  projects_reviewed: number
  challenges_passed: number
}

type FunnelStats = {
  registered: number
  onboarded: number
  lesson_done: number
  quiz_done: number
  project_done: number
  certified: number
}

type AdminPayload = {
  stats: DashboardStats
  funnel: FunnelStats
  skills: Array<{ skill: string; count: number }>
  engagement: Array<{ date: string; active_users: number }>
  top_events: Array<{ event: string; count: number }>
  xp_proxy: { daily_xp: Array<{ date: string; xp: number }> }
}

function EngagementLineChart({
  points,
}: {
  points: Array<{ date: string; active_users: number }>
}) {
  if (points.length === 0) {
    return <div className="text-brand-muted font-mono text-xs">No engagement data available yet.</div>
  }

  const width = 560
  const height = 220
  const padding = 24
  const maxY = Math.max(...points.map((p) => p.active_users), 1)
  const minY = Math.min(...points.map((p) => p.active_users), 0)
  const rangeY = Math.max(maxY - minY, 1)
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const polyline = points
    .map((p, idx) => {
      const x = padding + idx * stepX
      const y = height - padding - ((p.active_users - minY) / rangeY) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 rounded-lg bg-brand-bg border border-brand-border/60">
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = padding + (tick / 4) * (height - padding * 2)
          return (
            <line
              key={tick}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(107,122,153,0.2)"
              strokeDasharray="4 4"
            />
          )
        })}
        <polyline
          fill="none"
          stroke="#5B8EFF"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {points.map((p, idx) => {
          const x = padding + idx * stepX
          const y = height - padding - ((p.active_users - minY) / rangeY) * (height - padding * 2)
          return <circle key={p.date} cx={x} cy={y} r="4" fill="#4FFFA0" />
        })}
      </svg>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {points.slice(-6).map((p) => (
          <div key={p.date} className="rounded-md border border-brand-border/50 px-2 py-1.5 bg-brand-bg/60">
            <div className="text-[10px] text-brand-muted font-mono">{p.date.slice(5)}</div>
            <div className="text-xs text-brand-blue font-mono">{p.active_users}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function XpBarChart({
  points,
}: {
  points: Array<{ date: string; xp: number }>
}) {
  if (points.length === 0) {
    return <div className="text-brand-muted font-mono text-xs">No XP trend data available yet.</div>
  }

  const maxXp = Math.max(...points.map((p) => p.xp), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-52 rounded-lg bg-brand-bg border border-brand-border/60 p-3 overflow-x-auto">
        {points.map((p) => {
          const h = Math.max((p.xp / maxXp) * 100, 2)
          return (
            <div key={p.date} className="flex flex-col items-center justify-end min-w-10 h-full gap-1">
              <div
                className="w-7 rounded-t-sm bg-gradient-to-t from-brand-yellow/50 to-brand-yellow border border-brand-yellow/30"
                style={{ height: `${h}%` }}
                title={`${p.date}: ${p.xp} XP`}
              />
              <span className="text-[10px] text-brand-muted font-mono">{p.date.slice(5)}</span>
            </div>
          )
        })}
      </div>

      <div className="text-xs font-mono text-brand-muted">
        Peak daily XP: <span className="text-brand-yellow">{maxXp}</span>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/stats', { cache: 'no-store' })
        const payload = await res.json()
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load admin analytics')
        }
        setData(payload)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load admin analytics')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">Admin</div>
          <h1 className="font-display font-black text-4xl text-brand-text">Platform Analytics Dashboard</h1>
        </div>

        {error && (
          <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-4 text-brand-red font-mono text-sm">
            {error}
          </div>
        )}

        {!error && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Users', value: data.stats.total_users },
                { label: 'New This Week', value: data.stats.new_users_week },
                { label: 'Lessons Done', value: data.stats.total_lessons },
                { label: 'Quizzes Done', value: data.stats.total_quizzes },
                { label: 'Total XP', value: data.stats.total_xp },
                { label: 'Avg Streak', value: Number(data.stats.avg_streak || 0).toFixed(2) },
                { label: 'Certificates', value: data.stats.certs_issued },
                { label: 'Interviews', value: data.stats.interviews_done },
                { label: 'Projects Reviewed', value: data.stats.projects_reviewed },
                { label: 'Challenges Passed', value: data.stats.challenges_passed },
              ].map((item) => (
                <div key={item.label} className="bg-brand-surface border border-brand-border rounded-lg p-4">
                  <div className="text-brand-muted font-mono text-xs uppercase tracking-widest">{item.label}</div>
                  <div className="text-brand-text font-display font-black text-2xl mt-2">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                <div className="text-brand-text font-display font-bold text-lg mb-4">Completion Funnel</div>
                <div className="space-y-2">
                  {Object.entries(data.funnel || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-brand-border/40 py-2">
                      <span className="text-brand-muted font-mono text-xs uppercase tracking-widest">{k.replace('_', ' ')}</span>
                      <span className="text-brand-text font-mono text-sm">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                <div className="text-brand-text font-display font-bold text-lg mb-4">Top Skills</div>
                <div className="space-y-2">
                  {(data.skills || []).slice(0, 10).map((s) => (
                    <div key={s.skill} className="flex items-center justify-between border-b border-brand-border/40 py-2">
                      <span className="text-brand-text font-mono text-sm">{s.skill}</span>
                      <span className="text-brand-green font-mono text-sm">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                <div className="text-brand-text font-display font-bold text-lg mb-4">Daily Active Users</div>
                <EngagementLineChart points={data.engagement || []} />
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                <div className="text-brand-text font-display font-bold text-lg mb-4">Daily XP Trend</div>
                <XpBarChart points={data.xp_proxy?.daily_xp || []} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
                <div className="text-brand-text font-display font-bold text-lg mb-4">Top Events</div>
                <div className="space-y-2">
                  {(data.top_events || []).map((e) => (
                    <div key={e.event} className="flex items-center justify-between border-b border-brand-border/40 py-2">
                      <span className="text-brand-text font-mono text-sm">{e.event}</span>
                      <span className="text-brand-yellow font-mono text-sm">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
