// ── LearningVelocity ─────────────────────────────────────────
// Lightweight stat card showing lessons/week acceleration.
// Compares this week vs last week and projects a completion date.

interface Props {
  /** Lesson counts per week — index 0 = this week, index 1 = last week, etc. */
  weeklyLessonCounts: number[]
  totalWeeks:   number
  currentWeek:  number
  className?:   string
}

type Trend = 'up' | 'steady' | 'down'

export function LearningVelocity({
  weeklyLessonCounts,
  totalWeeks,
  currentWeek,
  className = '',
}: Props) {
  const thisWeek  = weeklyLessonCounts[0] ?? 0
  const lastWeek  = weeklyLessonCounts[1] ?? 0

  const delta: number = thisWeek - lastWeek
  const trend: Trend  = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady'

  const trendConfig = {
    up:     { icon: '↑', color: '#188038', label: 'Accelerating', bg: 'color-mix(in oklab, var(--color-app-surface-mint) 70%, var(--color-app-surface) 30%)' },
    steady: { icon: '→', color: '#f9ab00', label: 'Steady pace',  bg: 'color-mix(in oklab, var(--color-app-surface-warm) 70%, var(--color-app-surface) 30%)' },
    down:   { icon: '↓', color: '#c5221f', label: 'Slowing down', bg: 'color-mix(in oklab, var(--color-app-surface) 85%, #c5221f 15%)' },
  }[trend]

  // Projected completion: remaining weeks / avg pace per week
  const avgPerWeek   = weeklyLessonCounts.length > 0
    ? weeklyLessonCounts.reduce((a, b) => a + b, 0) / weeklyLessonCounts.length
    : 1
  const weeksLeft    = Math.max(0, totalWeeks - currentWeek + 1)
  const projDate     = new Date()
  projDate.setDate(projDate.getDate() + Math.ceil(avgPerWeek > 0 ? weeksLeft * 7 : weeksLeft * 14))
  const projLabel    = projDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Mini sparkline — last 4 weeks (index 3 → 0, oldest → newest)
  const sparkData    = [...weeklyLessonCounts].reverse().slice(-4)
  const sparkMax     = Math.max(1, ...sparkData)
  const BAR_H        = 28

  return (
    <div
      className={`tilt-card neo-surface relative overflow-hidden rounded-2xl p-6 ${className}`}
      style={{ background: trendConfig.bg }}
    >
      {/* Trend icon + label */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs tracking-widest uppercase font-bold mb-1"
            style={{ color: trendConfig.color }}>
            Velocity
          </p>
          <div className="font-display font-black text-3xl" style={{ color: trendConfig.color, letterSpacing: '-1px' }}>
            {trendConfig.icon} {thisWeek}
            <span className="text-base font-bold ml-1">lessons</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-app-text-secondary)' }}>
            {trendConfig.label} · {delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} vs last week` : 'same as last week'}
          </p>
        </div>

        {/* Sparkline bars */}
        <div className="flex items-end gap-1">
          {sparkData.map((val, i) => (
            <div key={i} className="rounded-sm w-3 transition-all"
              style={{
                height: Math.max(4, Math.round((val / sparkMax) * BAR_H)),
                background: i === sparkData.length - 1
                  ? trendConfig.color
                  : `${trendConfig.color}50`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Projected completion */}
      <div className="flex items-center gap-2 mt-3 pt-3"
        style={{ borderTop: `1px solid ${trendConfig.color}25` }}>
        <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
          Projected finish:
        </span>
        <span className="text-xs font-bold" style={{ color: trendConfig.color }}>
          {weeksLeft === 0 ? '🎉 Complete!' : projLabel}
        </span>
      </div>
    </div>
  )
}
