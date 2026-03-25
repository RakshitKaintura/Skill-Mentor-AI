'use client'
import { useRouter } from 'next/navigation'

interface ChallengeCardProps {
  lessonId:   string
  roadmapId:  string
  topic:      string
  skill:      string
  difficulty: string
  language?:  string
  passed?:    boolean
  hintsUsed?: number
  xpAwarded?: number
}

export default function ChallengeCard({
  lessonId, roadmapId, topic, skill,
  difficulty, language = 'javascript',
  passed, hintsUsed, xpAwarded,
}: ChallengeCardProps) {
  const router = useRouter()

  const openPlayground = () => {
    const sp = new URLSearchParams({
      topic, skill, difficulty, language,
      roadmap_id: roadmapId,
      lesson_id:  lessonId,
    })
    router.push(`/playground?${sp}`)
  }

  const langEmoji: Record<string, string> = {
    javascript: '🟨',
    python:     '🐍',
    typescript: '🔷',
    java:       '☕',
    cpp:        '⚙️',
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 hover:border-brand-yellow/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-brand-text font-mono text-sm font-medium">{topic}</div>
          <div className="text-brand-muted font-mono text-xs mt-0.5">
            {langEmoji[language] || '💻'} {language} · Code Challenge
          </div>
        </div>
        {passed && (
          <span className="text-brand-green text-xs font-mono bg-brand-green/10 border border-brand-green/30 px-2 py-0.5 rounded">
            ✓ +{xpAwarded} XP
          </span>
        )}
      </div>

      {passed ? (
        <div className="flex items-center justify-between">
          <div className="text-brand-muted font-mono text-xs">
            Used {hintsUsed}/3 hints
          </div>
          <button onClick={openPlayground} className="text-brand-muted font-mono text-xs hover:text-brand-text transition-colors">
            Redo →
          </button>
        </div>
      ) : (
        <button
          onClick={openPlayground}
          className="w-full bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow py-2.5 rounded-lg font-mono text-sm hover:bg-brand-yellow/20 transition-colors"
        >
          Open Playground →
        </button>
      )}
    </div>
  )
}