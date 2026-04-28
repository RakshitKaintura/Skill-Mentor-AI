// ── SkillXpDonut ─────────────────────────────────────────────
// Pure-SVG donut chart showing XP distribution across all skills.

import type { SkillStat } from './SkillsLibrary'

interface Props {
  skills:   SkillStat[]
  totalXp:  number
  className?: string
}

const PALETTE = ['#4FFFA0', '#5B8EFF', '#C77DFF', '#FFD166', '#FF6B6B', '#4ECDC4']

// ── SVG donut arc builder ─────────────────────────────────────

function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// ── Component ─────────────────────────────────────────────────

export function SkillXpDonut({ skills, totalXp, className = '' }: Props) {
  // Use per-roadmap xpEstimate; fall back to totalXp distributed evenly
  const totalEstimate = skills.reduce((s, sk) => s + sk.xpEstimate, 0) || 1

  // Build arc segments
  let cursor = 0
  const segments = skills.map((sk, i) => {
    const frac  = sk.xpEstimate / totalEstimate
    const sweep = frac * 360
    const start = cursor
    const end   = cursor + sweep - (skills.length > 1 ? 2 : 0) // 2° gap between arcs
    cursor += sweep
    return {
      skill: sk.skill,
      xp:    sk.xpEstimate,
      pct:   Math.round(frac * 100),
      path:  sweep > 1 ? describeArc(80, 80, 58, start, Math.max(start + 1, end)) : null,
      color: PALETTE[i % PALETTE.length],
    }
  })

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>

      <div className="px-5 pt-5 pb-2">
        <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#C77DFF' }}>
          XP Distribution
        </p>
        <p className="font-display font-black text-xl" style={{ letterSpacing: '-0.5px' }}>
          Effort Across Skills
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 px-5 pb-5">
        {/* Donut SVG */}
        <div className="relative flex-shrink-0">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {/* Background track */}
            <circle cx="80" cy="80" r="58" fill="none"
              stroke="var(--color-app-border)" strokeWidth="16" />

            {/* Skill arcs */}
            {segments.map(seg =>
              seg.path ? (
                <path
                  key={seg.skill}
                  d={seg.path}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              ) : null
            )}

            {/* Center label */}
            <text x="80" y="74" textAnchor="middle"
              fontSize="11" fill="var(--color-app-text-secondary)" fontFamily="var(--font-manrope)">
              Total XP
            </text>
            <text x="80" y="92" textAnchor="middle"
              fontSize="22" fontWeight="900" fill="var(--color-app-primary)" fontFamily="var(--font-manrope)">
              {totalXp}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          {segments.map(seg => (
            <div key={seg.skill} className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--color-app-text-primary)' }}>
                    {seg.skill}
                  </span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: seg.color }}>
                    {seg.pct}%
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="h-1 rounded-full mt-1" style={{ background: 'var(--color-app-border)' }}>
                  <div className="h-1 rounded-full transition-all"
                    style={{ width: `${seg.pct}%`, background: seg.color }} />
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-app-text-secondary)' }}>
                  ~{seg.xp} XP earned
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
