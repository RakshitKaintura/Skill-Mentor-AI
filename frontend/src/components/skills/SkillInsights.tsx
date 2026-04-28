// ── SkillInsights ─────────────────────────────────────────────
// Strongest Skill / Needs Attention badges + auto-summary sentence.
// Pure data-logic component — no AI call needed.

import Link from 'next/link'
import { Trophy, AlertTriangle, Zap } from 'lucide-react'
import type { SkillStat } from './SkillsLibrary'

interface Props {
  skills: SkillStat[]
}

// ── Auto-summary sentence generator ──────────────────────────

function buildSummary(skills: SkillStat[]): string {
  if (skills.length < 2) return ''

  const sorted   = [...skills].sort((a, b) => b.progressPercent - a.progressPercent)
  const best     = sorted[0]
  const worst    = sorted[sorted.length - 1]
  const gap      = best.progressPercent - worst.progressPercent
  const mostActive = [...skills].sort((a, b) => b.lessonsCompleted - a.lessonsCompleted)[0]

  const parts: string[] = []

  if (gap >= 20) {
    parts.push(`You're ${gap}% further ahead in ${best.skill} than ${worst.skill}.`)
  } else if (gap > 0) {
    parts.push(`${best.skill} and ${worst.skill} are at similar progress levels — ${gap}% apart.`)
  }

  if (worst.avgQuizScore > 0 && worst.avgQuizScore < 60) {
    parts.push(`Your ${worst.skill} quiz average (${worst.avgQuizScore}%) needs attention.`)
  } else if (best.avgQuizScore >= 80) {
    parts.push(`Strong quiz performance in ${best.skill} at ${best.avgQuizScore}% average.`)
  }

  if (mostActive.lessonsCompleted > 0 && mostActive.skill !== best.skill) {
    parts.push(`Most active skill: ${mostActive.skill} with ${mostActive.lessonsCompleted} lesson${mostActive.lessonsCompleted > 1 ? 's' : ''} completed.`)
  }

  return parts.join(' ') || `You're tracking ${skills.length} skills simultaneously — great commitment!`
}

// ── Badge card ────────────────────────────────────────────────

function InsightBadge({
  icon: Icon, label, skillName, sub, color, bg, border,
  roadmapId,
}: {
  icon: typeof Trophy; label: string; skillName: string; sub: string;
  color: string; bg: string; border: string; roadmapId: string
}) {
  return (
    <Link
      href={`/lesson/current?roadmap_id=${encodeURIComponent(roadmapId)}`}
      className="flex items-center gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:opacity-90"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>
          {label}
        </p>
        <p className="font-display font-black text-base truncate" style={{ color: 'var(--color-app-text-primary)', letterSpacing: '-0.3px' }}>
          {skillName}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-app-text-secondary)' }}>
          {sub}
        </p>
      </div>
    </Link>
  )
}

// ── Component ─────────────────────────────────────────────────

export function SkillInsights({ skills }: Props) {
  if (skills.length < 2) return null

  const byProgress  = [...skills].sort((a, b) => b.progressPercent - a.progressPercent)
  const strongest   = byProgress[0]
  const weakest     = byProgress[byProgress.length - 1]
  const mostActive  = [...skills].sort((a, b) => b.lessonsCompleted - a.lessonsCompleted)[0]
  const summary     = buildSummary(skills)

  return (
    <div className="mb-6 space-y-4">
      {/* Summary sentence */}
      {summary && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in oklab, var(--color-app-surface-cool) 60%, var(--color-app-surface) 40%)',
            border: '1px solid color-mix(in oklab, var(--color-app-primary) 18%, var(--color-app-border))',
            color: 'var(--color-app-text-primary)',
          }}>
          <span className="font-bold" style={{ color: 'var(--color-app-primary)' }}>💡 Insight: </span>
          {summary}
        </div>
      )}

      {/* Badge row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InsightBadge
          icon={Trophy}
          label="Strongest Skill"
          skillName={strongest.skill}
          sub={`${strongest.progressPercent}% complete · Week ${strongest.currentWeek}/${strongest.totalWeeks}`}
          color="#188038"
          bg="color-mix(in oklab, var(--color-app-surface-mint) 55%, var(--color-app-surface) 45%)"
          border="color-mix(in oklab, #188038 22%, var(--color-app-border))"
          roadmapId={strongest.roadmapId}
        />

        <InsightBadge
          icon={AlertTriangle}
          label="Needs Attention"
          skillName={weakest.skill}
          sub={weakest.avgQuizScore > 0 && weakest.avgQuizScore < 60
            ? `Quiz avg ${weakest.avgQuizScore}% — keep practising`
            : `${weakest.progressPercent}% complete — behind schedule`}
          color="#f9ab00"
          bg="color-mix(in oklab, var(--color-app-surface-warm) 50%, var(--color-app-surface) 50%)"
          border="color-mix(in oklab, #f9ab00 22%, var(--color-app-border))"
          roadmapId={weakest.roadmapId}
        />

        <InsightBadge
          icon={Zap}
          label="Most Active"
          skillName={mostActive.skill}
          sub={`${mostActive.lessonsCompleted} lesson${mostActive.lessonsCompleted !== 1 ? 's' : ''} · ${mostActive.quizzesDone} quiz${mostActive.quizzesDone !== 1 ? 'zes' : ''}`}
          color="#5B8EFF"
          bg="color-mix(in oklab, var(--color-app-surface-cool) 55%, var(--color-app-surface) 45%)"
          border="color-mix(in oklab, #5B8EFF 22%, var(--color-app-border))"
          roadmapId={mostActive.roadmapId}
        />
      </div>
    </div>
  )
}
