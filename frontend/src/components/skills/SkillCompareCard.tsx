// ── SkillCompareCard ──────────────────────────────────────────
// A single skill column in the comparison grid.
// Shows a radial progress ring, ranked medal, and key metrics.

import Link from 'next/link'
import { ArrowRight, BookOpen, Brain, BarChart2, CalendarDays } from 'lucide-react'
import { buttonClassName } from '@/components/ui/Button'
import type { SkillStat } from './SkillsLibrary'

interface Props {
  stat:       SkillStat
  rank:       number          // 1 = highest progress, 2 = second, etc.
  totalSkills: number
}

const GOAL_LABEL: Record<string, string> = {
  get_job: 'Get a job', freelance: 'Freelance', build_project: 'Build project',
  exam: 'Exam prep', upskill: 'Upskill',
}

const RANK_CONFIG = [
  { medal: '🥇', border: '#188038', glow: 'rgba(24,128,56,0.18)',  label: 'Leading'       },
  { medal: '🥈', border: '#5B8EFF', glow: 'rgba(91,142,255,0.14)', label: 'On track'      },
  { medal: '🥉', border: '#f9ab00', glow: 'rgba(249,171,0,0.14)',  label: 'Needs focus'   },
]

const ACCENT_COLORS = ['#4FFFA0', '#5B8EFF', '#C77DFF', '#FFD166', '#FF6B6B', '#4ECDC4']

// ── Radial progress ring (pure SVG) ──────────────────────────

function RadialRing({ percent, color }: { percent: number; color: string }) {
  const R    = 44
  const CIRC = 2 * Math.PI * R
  const dash = (percent / 100) * CIRC
  const gap  = CIRC - dash

  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="mx-auto">
      {/* Track */}
      <circle cx="55" cy="55" r={R} fill="none"
        stroke="var(--color-app-border)" strokeWidth="8" />
      {/* Progress arc — starts at top (-90°) */}
      <circle cx="55" cy="55" r={R} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Center text */}
      <text x="55" y="50" textAnchor="middle" dominantBaseline="middle"
        fontSize="18" fontWeight="800" fill={color} fontFamily="var(--font-manrope)">
        {percent}%
      </text>
      <text x="55" y="66" textAnchor="middle"
        fontSize="9" fill="var(--color-app-text-secondary)" fontFamily="var(--font-manrope)">
        progress
      </text>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────

export function SkillCompareCard({ stat, rank, totalSkills }: Props) {
  const rankCfg  = RANK_CONFIG[Math.min(rank - 1, RANK_CONFIG.length - 1)]
  const color    = ACCENT_COLORS[(rank - 1) % ACCENT_COLORS.length]

  const isLeader  = rank === 1
  const isLagging = rank === totalSkills && totalSkills > 1

  const borderColor = isLeader
    ? 'color-mix(in oklab, #188038 35%, var(--color-app-border))'
    : isLagging
    ? 'color-mix(in oklab, #f9ab00 30%, var(--color-app-border))'
    : 'var(--color-app-border)'

  const bgColor = isLeader
    ? 'color-mix(in oklab, var(--color-app-surface-mint) 25%, var(--color-app-surface) 75%)'
    : isLagging
    ? 'color-mix(in oklab, var(--color-app-surface-warm) 20%, var(--color-app-surface) 80%)'
    : 'var(--color-app-surface)'

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-0.5"
      style={{
        border:     `1px solid ${borderColor}`,
        background: bgColor,
        boxShadow:  isLeader ? `0 0 0 2px ${rankCfg.glow}, 0 8px 24px ${rankCfg.glow}` : undefined,
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: color }} />

      <div className="p-5 flex flex-col flex-1 gap-4">

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-black text-lg truncate" style={{ letterSpacing: '-0.5px' }}>
              {stat.skill}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                {stat.level}
              </span>
              <span className="text-[10px] text-[var(--color-app-text-secondary)]">
                {GOAL_LABEL[stat.goal] ?? stat.goal}
              </span>
            </div>
          </div>
          {/* Rank medal */}
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <span className="text-2xl">{rankCfg.medal}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: rankCfg.border }}>
              {rankCfg.label}
            </span>
          </div>
        </div>

        {/* Radial ring */}
        <RadialRing percent={stat.progressPercent} color={color} />

        {/* Metric rows */}
        <div className="flex flex-col gap-2">
          {[
            { Icon: CalendarDays, label: 'Week',       value: `${stat.currentWeek} / ${stat.totalWeeks}`,  color: '#5B8EFF' },
            { Icon: BookOpen,     label: 'Lessons',     value: stat.lessonsCompleted,                       color: '#188038' },
            { Icon: Brain,        label: 'Quizzes',     value: stat.quizzesDone,                            color: '#C77DFF' },
            { Icon: BarChart2,    label: 'Avg Score',   value: stat.quizzesDone > 0 ? `${stat.avgQuizScore}%` : '—', color: '#f9ab00' },
          ].map(({ Icon, label, value, color: c }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-app-text-secondary)' }}>
                <Icon size={12} style={{ color: c }} />
                {label}
              </div>
              <span className="font-bold" style={{ color: 'var(--color-app-text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Current topic */}
        <div className="rounded-lg px-3 py-2 text-xs"
          style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
          <span style={{ color: 'var(--color-app-text-secondary)' }}>Topic: </span>
          <span className="font-semibold truncate" style={{ color }}>
            {stat.currentTopic}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={`/lesson/current?roadmap_id=${encodeURIComponent(stat.roadmapId)}`}
          className={buttonClassName({ variant: isLeader ? 'primary' : 'secondary' })}
        >
          Continue <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
