'use client'

// ── MasteryRadar ─────────────────────────────────────────────
// Pure-SVG radar / spider chart — no charting library needed.
// Renders up to 8 topic axes from user_progress.topic_mastery.

interface Props {
  topicMastery: Record<string, number>  // { "Variables": 85, "Functions": 60 }
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────

/** Convert polar (angle, radius) → Cartesian (x, y). cx/cy = origin. */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/** Build an SVG polygon points string from an array of {x,y}. */
function toPoints(pts: { x: number; y: number }[]) {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/** Linear interpolation for score → color. */
function scoreColor(score: number) {
  if (score >= 85) return '#188038'   // strong — green
  if (score >= 50) return '#f9ab00'   // moderate — amber
  return '#c5221f'                    // weak — red
}

// ── Component ────────────────────────────────────────────────

export function MasteryRadar({ topicMastery, className = '' }: Props) {
  const entries = Object.entries(topicMastery)
    .sort((a, b) => b[1] - a[1])   // highest mastery first
    .slice(0, 8)                    // cap at 8 axes

  // ── Empty state ──────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center ${className}`}
        style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}
      >
        <span className="text-3xl">🧠</span>
        <p className="font-display font-bold text-sm">No mastery data yet</p>
        <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
          Complete quizzes to build your skill mastery map
        </p>
      </div>
    )
  }

  // ── SVG geometry ─────────────────────────────────────────
  const SIZE   = 260        // viewBox size
  const cx     = SIZE / 2   // 130
  const cy     = SIZE / 2   // 130
  const R_MAX  = 90         // outermost ring radius
  const N      = entries.length
  const RINGS  = [0.25, 0.5, 0.75, 1]  // concentric ring fractions

  const angleStep = 360 / N

  // Web polygon vertices (max radius)
  const webPoints = entries.map((_, i) => polar(cx, cy, R_MAX, i * angleStep))

  // Score polygon vertices (scaled by score/100)
  const scorePoints = entries.map(([, score], i) =>
    polar(cx, cy, R_MAX * Math.min(100, Math.max(0, score)) / 100, i * angleStep)
  )

  const avgMastery = Math.round(
    entries.reduce((s, [, v]) => s + v, 0) / entries.length
  )

  const strongCount = entries.filter(([, v]) => v >= 85).length
  const weakCount   = entries.filter(([, v]) => v < 50).length

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--color-app-primary)' }}>
            Skill Mastery
          </p>
          <p className="font-display font-black text-xl" style={{ letterSpacing: '-0.5px' }}>
            Mastery Radar
          </p>
        </div>
        {/* Average badge */}
        <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full"
          style={{
            background: `conic-gradient(${scoreColor(avgMastery)} ${avgMastery * 3.6}deg, var(--color-app-border) 0deg)`,
            padding: '3px',
          }}>
          <div className="w-full h-full rounded-full flex flex-col items-center justify-center"
            style={{ background: 'var(--color-app-surface)' }}>
            <span className="font-display font-black text-sm leading-none" style={{ color: scoreColor(avgMastery) }}>
              {avgMastery}%
            </span>
            <span className="text-[9px]" style={{ color: 'var(--color-app-text-secondary)' }}>avg</span>
          </div>
        </div>
      </div>

      {/* SVG Radar */}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[260px] mx-auto">
        {/* Concentric rings */}
        {RINGS.map(fraction => (
          <polygon
            key={fraction}
            points={toPoints(entries.map((_, i) => polar(cx, cy, R_MAX * fraction, i * angleStep)))}
            fill="none"
            stroke="var(--color-app-border)"
            strokeWidth="1"
            opacity="0.7"
          />
        ))}

        {/* Axis lines */}
        {webPoints.map((pt, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={pt.x} y2={pt.y}
            stroke="var(--color-app-border)"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}

        {/* Score polygon fill */}
        <polygon
          points={toPoints(scorePoints)}
          fill="var(--color-app-primary)"
          fillOpacity="0.18"
          stroke="var(--color-app-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Score dots */}
        {scorePoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x} cy={pt.y}
            r="4"
            fill={scoreColor(entries[i][1])}
            stroke="var(--color-app-surface)"
            strokeWidth="2"
          />
        ))}

        {/* Axis labels */}
        {entries.map(([topic, score], i) => {
          const angle    = i * angleStep
          const labelPt  = polar(cx, cy, R_MAX + 18, angle)
          const anchor   = labelPt.x < cx - 4 ? 'end' : labelPt.x > cx + 4 ? 'start' : 'middle'
          const shortTopic = topic.length > 12 ? topic.slice(0, 11) + '…' : topic
          return (
            <g key={topic}>
              <text
                x={labelPt.x} y={labelPt.y - 5}
                textAnchor={anchor}
                fontSize="9"
                fontWeight="700"
                fill="var(--color-app-text-primary)"
                fontFamily="var(--font-manrope)"
              >
                {shortTopic}
              </text>
              <text
                x={labelPt.x} y={labelPt.y + 6}
                textAnchor={anchor}
                fontSize="8"
                fill={scoreColor(score)}
                fontFamily="var(--font-manrope)"
              >
                {score}%
              </text>
            </g>
          )
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3" fill="var(--color-app-primary)" opacity="0.5" />
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-5 pb-5 pt-1">
        {[
          { label: 'Strong (≥85%)',  color: '#188038', count: strongCount },
          { label: 'Building',        color: '#f9ab00', count: entries.length - strongCount - weakCount },
          { label: 'Needs work',      color: '#c5221f', count: weakCount   },
        ].map(({ label, color, count }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
              {label} <span className="font-bold" style={{ color }}>{count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
