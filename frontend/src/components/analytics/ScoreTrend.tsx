'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────

export interface QuizDataPoint {
  date:  string   // display label e.g. "Apr 12"
  score: number   // percentage 0-100
  topic: string
}

interface Props {
  quizHistory: QuizDataPoint[]
  className?: string
}

// ── Trend line (simple linear regression) ────────────────────

function linearRegression(data: QuizDataPoint[]) {
  const n = data.length
  if (n < 2) return data.map(d => ({ ...d, trend: d.score }))

  const xs = data.map((_, i) => i)
  const ys = data.map(d => d.score)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  const num   = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0)
  const den   = xs.reduce((s, x)    => s + (x - meanX) ** 2, 0)
  const slope = den !== 0 ? num / den : 0
  const intercept = meanY - slope * meanX

  return data.map((d, i) => ({
    ...d,
    trend: Math.min(100, Math.max(0, Math.round(intercept + slope * i))),
  }))
}

// ── Custom tooltip ────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: QuizDataPoint & { trend: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = d.score >= 85 ? '#188038' : d.score >= 70 ? '#f9ab00' : '#c5221f'
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl text-xs"
      style={{ background: 'var(--color-app-surface)', border: '1px solid var(--color-app-border)' }}>
      <p className="font-bold mb-1 truncate max-w-[160px]" style={{ color: 'var(--color-app-text-primary)' }}>
        {d.topic}
      </p>
      <p style={{ color }}><span className="font-black text-base">{d.score}%</span></p>
      <p style={{ color: 'var(--color-app-text-secondary)' }}>{d.date}</p>
    </div>
  )
}

// ── Custom dot ────────────────────────────────────────────────

function ScoreDot(props: { cx?: number; cy?: number; payload?: QuizDataPoint }) {
  const { cx = 0, cy = 0, payload } = props
  const score = payload?.score ?? 0
  const color = score >= 85 ? '#188038' : score >= 70 ? '#f9ab00' : '#c5221f'
  return (
    <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--color-app-surface)" strokeWidth={2} />
  )
}

// ── Component ─────────────────────────────────────────────────

export function ScoreTrend({ quizHistory, className = '' }: Props) {
  if (quizHistory.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center ${className}`}
        style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>
        <span className="text-3xl">📊</span>
        <p className="font-display font-bold text-sm">No quiz data yet</p>
        <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
          Complete quizzes to see your score trend over time
        </p>
      </div>
    )
  }

  const dataWithTrend = linearRegression(quizHistory)
  const avgScore = Math.round(quizHistory.reduce((s, d) => s + d.score, 0) / quizHistory.length)
  const latest   = quizHistory[quizHistory.length - 1]?.score ?? 0
  const first    = quizHistory[0]?.score ?? 0
  const delta    = latest - first
  const trendColor = delta >= 5 ? '#188038' : delta <= -5 ? '#c5221f' : '#f9ab00'
  const trendLabel = delta >= 5 ? `↑ +${delta}%` : delta <= -5 ? `↓ ${delta}%` : `→ Steady`

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#5B8EFF' }}>
            Quiz Performance
          </p>
          <p className="font-display font-black text-xl" style={{ letterSpacing: '-0.5px' }}>
            Score Trend
          </p>
        </div>
        <div className="text-right">
          <p className="font-display font-black text-2xl" style={{ color: '#5B8EFF' }}>
            {avgScore}%
          </p>
          <p className="text-xs font-bold" style={{ color: trendColor }}>{trendLabel}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-5" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataWithTrend} margin={{ top: 10, right: 16, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#5B8EFF" />
                <stop offset="100%" stopColor="#C77DFF" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-app-border)" />
            <XAxis
              dataKey="date"
              axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-app-text-secondary)' }}
              dy={6}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-app-text-secondary)' }}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Pass/fail reference lines */}
            <ReferenceLine y={85} stroke="#18803830" strokeDasharray="4 4" label={{ value: 'Excellent', fill: '#18803870', fontSize: 9, position: 'insideTopRight' }} />
            <ReferenceLine y={70} stroke="#f9ab0030" strokeDasharray="4 4" label={{ value: 'Pass', fill: '#f9ab0070', fontSize: 9, position: 'insideTopRight' }} />
            {/* Trend line */}
            <Line
              type="monotone" dataKey="trend"
              stroke={trendColor} strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false} activeDot={false}
            />
            {/* Actual scores */}
            <Line
              type="monotone" dataKey="score"
              stroke="url(#scoreGrad)" strokeWidth={2.5}
              dot={<ScoreDot />}
              activeDot={{ r: 7, fill: '#5B8EFF', stroke: 'var(--color-app-surface)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 pb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 rounded-full" style={{ background: 'url(#scoreGrad)', backgroundColor: '#5B8EFF' }} />
          <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>Quiz score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t border-dashed" style={{ borderColor: trendColor }} />
          <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>Trend line</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full" style={{ background: '#188038' }} />
          <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>≥85% excellent</span>
        </div>
      </div>
    </div>
  )
}
