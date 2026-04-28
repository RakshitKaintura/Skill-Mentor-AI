'use client'

// ── SkillsLibrary ─────────────────────────────────────────────
// Client wrapper that owns the Library ↔ Compare view toggle.
// Receives all data as props from the server component (page.tsx).

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, CalendarDays, ArrowRight,
  Target, Layers, LayoutGrid, GitCompare,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import { buttonClassName }   from '@/components/ui/Button'
import { DeleteSkillButton } from '@/components/skills/DeleteSkillButton'
import { SkillCompareCard }  from '@/components/skills/SkillCompareCard'
import { SkillXpDonut }      from '@/components/skills/SkillXpDonut'
import { SkillInsights }     from '@/components/skills/SkillInsights'

// ── Shared type exported so sub-components can import it ─────

export interface SkillStat {
  roadmapId:        string
  skill:            string
  level:            string
  goal:             string
  totalWeeks:       number
  currentWeek:      number
  progressPercent:  number
  phasesCount:      number
  currentTopic:     string
  createdAt:        string
  lessonsCompleted: number
  quizzesDone:      number
  avgQuizScore:     number
  xpEstimate:       number
}

interface Props {
  skills:  SkillStat[]
  totalXp: number
}

type ViewMode = 'library' | 'compare'

// ── Helpers ───────────────────────────────────────────────────

const GOAL_LABEL: Record<string, string> = {
  get_job: 'Get a job', freelance: 'Freelance work',
  build_project: 'Build a project', exam: 'Exam prep', upskill: 'Upskill',
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Library view (existing grid — pixel-identical to before) ──

function LibraryGrid({ skills }: { skills: SkillStat[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {skills.map(sk => (
        <Card key={sk.roadmapId} className="bg-[var(--color-app-surface)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-app-text-primary)]">{sk.skill}</h2>
              <p className="text-sm text-[var(--color-app-text-secondary)]">
                {sk.level} · {GOAL_LABEL[sk.goal] ?? sk.goal}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-app-surface-cool)] px-2.5 py-1 text-xs font-semibold text-[var(--color-app-primary)]">
                Week {sk.currentWeek}/{sk.totalWeeks}
              </span>
              <DeleteSkillButton roadmapId={sk.roadmapId} skillName={sk.skill} />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 text-xs text-[var(--color-app-text-secondary)]">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={13} /> Created {formatDate(sk.createdAt)}
            </div>
            <div className="flex items-center gap-1.5">
              <Layers size={13} /> {sk.phasesCount} phases
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Target size={13} /> Current topic: {sk.currentTopic}
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-app-text-secondary)]">
              <span>Progress</span>
              <span className="font-semibold text-[var(--color-app-primary)]">{sk.progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-app-bg)]">
              <div className="h-2 rounded-full bg-[var(--color-app-primary)] transition-all"
                style={{ width: `${sk.progressPercent}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/lesson/current?roadmap_id=${encodeURIComponent(sk.roadmapId)}`}
              className={buttonClassName()}>
              Continue Skill <ArrowRight size={14} />
            </Link>
            <Link href="/roadmap" className={buttonClassName({ variant: 'secondary' })}>
              View Roadmap
            </Link>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Compare view ──────────────────────────────────────────────

function CompareView({ skills, totalXp }: { skills: SkillStat[]; totalXp: number }) {
  if (skills.length < 2) {
    return (
      <Card className="bg-[var(--color-app-surface-cool)] text-center py-12">
        <GitCompare size={32} className="mx-auto mb-3 text-[var(--color-app-text-secondary)]" />
        <h3 className="text-lg font-semibold mb-2">Need at least 2 skills to compare</h3>
        <p className="text-sm text-[var(--color-app-text-secondary)] mb-5 max-w-xs mx-auto">
          Create a second learning roadmap and come back here to compare your progress side by side.
        </p>
        <Link href="/onboarding?mode=new-skill" className={buttonClassName()}>
          <BookOpen size={14} /> Create New Skill
        </Link>
      </Card>
    )
  }

  // Sort by progress descending — rank 1 = highest
  const ranked = [...skills].sort((a, b) => b.progressPercent - a.progressPercent)

  // Grid cols: 2 for ≤2 skills, 3 for 3, 2 with wrap for 4+
  const gridCols = skills.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
    : skills.length === 3 ? 'grid-cols-1 sm:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className="space-y-6">
      {/* Insight badges + auto-summary */}
      <SkillInsights skills={skills} />

      {/* Donut chart (shown only for 2+ skills) */}
      <SkillXpDonut skills={skills} totalXp={totalXp} />

      {/* Comparison cards */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-app-text-secondary)' }}>
          Side-by-Side Comparison · ranked by progress
        </p>
        <div className={`grid gap-4 ${gridCols}`}>
          {ranked.map((sk, i) => (
            <SkillCompareCard
              key={sk.roadmapId}
              stat={sk}
              rank={i + 1}
              totalSkills={ranked.length}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────

export function SkillsLibrary({ skills, totalXp }: Props) {
  const [view, setView] = useState<ViewMode>('library')

  const canCompare = skills.length >= 2

  return (
    <div>
      {/* View toggle */}
      {skills.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          {/* Toggle pill */}
          <div className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-app-border)', width: 'fit-content' }}>
            {[
              { mode: 'library' as ViewMode,  Icon: LayoutGrid,  label: 'Library'  },
              { mode: 'compare' as ViewMode,  Icon: GitCompare,  label: 'Compare'  },
            ].map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all"
                style={{
                  background: view === mode
                    ? 'color-mix(in oklab, var(--color-app-primary) 10%, var(--color-app-surface))'
                    : 'var(--color-app-surface)',
                  color: view === mode
                    ? 'var(--color-app-primary)'
                    : 'var(--color-app-text-secondary)',
                  borderRight: mode === 'library' ? '1px solid var(--color-app-border)' : 'none',
                }}
              >
                <Icon size={13} />
                {label}
                {mode === 'compare' && !canCompare && (
                  <span className="ml-1 text-[9px] opacity-60">(need 2+)</span>
                )}
              </button>
            ))}
          </div>

          {/* Skill count badge */}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: 'color-mix(in oklab, var(--color-app-surface-cool) 70%, var(--color-app-surface) 30%)',
              border: '1px solid var(--color-app-border)',
              color: 'var(--color-app-text-secondary)',
            }}>
            {skills.length} skill{skills.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Content */}
      {skills.length === 0 ? (
        <Card className="bg-[var(--color-app-surface-cool)] text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-[var(--color-app-text-secondary)]" />
          <h2 className="text-lg font-semibold">No skills yet</h2>
          <p className="mt-2 text-sm text-[var(--color-app-text-secondary)]">
            Generate your first roadmap to start learning.
          </p>
          <div className="mt-5">
            <Link href="/onboarding" className={buttonClassName()}>
              Create First Roadmap <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      ) : view === 'library' ? (
        <LibraryGrid skills={skills} />
      ) : (
        <CompareView skills={skills} totalXp={totalXp} />
      )}
    </div>
  )
}
