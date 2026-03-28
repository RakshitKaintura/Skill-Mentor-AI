'use client'
import { useRouter } from 'next/navigation'
import type { DailyChallenge } from '@/types/week5'

interface DailyChallengeCardProps {
  challenge:  DailyChallenge
}

const typeConfig = {
  quiz:    { emoji: '❓', label: 'Daily Quiz',   color: 'border-brand-blue/40   text-brand-blue' },
  code:    { emoji: '💻', label: 'Code Task',    color: 'border-brand-yellow/40 text-brand-yellow' },
  theory:  { emoji: '📖', label: 'Theory',       color: 'border-brand-purple/40 text-brand-purple' },
  review:  { emoji: '🔁', label: 'Review',       color: 'border-brand-green/40  text-brand-green' },
}

export default function DailyChallengeCard({ challenge }: DailyChallengeCardProps) {
  const router   = useRouter()
  const config = typeConfig[challenge.type] || typeConfig.quiz

  const handleStart = () => {
    router.push(`/daily-challenge/${challenge.challenge_id}`)
  }

  return (
    <div className={`bg-brand-surface rounded-xl border p-5 transition-all ${
      challenge.completed
        ? 'border-brand-green/30 opacity-80'
        : 'border-brand-border hover:border-brand-green/30'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.emoji}</span>
          <div>
            <div className={`text-xs font-mono border px-2 py-0.5 rounded ${config.color}`}>
              {config.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-brand-yellow font-mono text-sm font-bold">
            +{challenge.xp_reward ?? challenge.content?.xp_reward ?? 50} XP
          </div>
          <div className="text-brand-muted font-mono text-xs">~{challenge.estimated_minutes}min</div>
        </div>
      </div>

      <div className="text-brand-text font-mono text-sm font-medium mb-1">{challenge.title}</div>
      <div className="text-brand-muted font-mono text-xs leading-relaxed mb-4">{challenge.description}</div>

      {challenge.completed ? (
        <div className="text-brand-green font-mono text-xs text-center py-2">
          ✓ Completed today!
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="w-full bg-brand-green/10 border border-brand-green/30 text-brand-green py-2.5 rounded-lg font-mono text-sm hover:bg-brand-green/20 transition-colors"
        >
          Start Challenge →
        </button>
      )}
    </div>
  )
}