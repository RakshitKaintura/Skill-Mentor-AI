'use client'
import { useRouter } from 'next/navigation'

interface QuizCardProps {
  lessonId: string
  roadmapId: string
  topic: string
  skill: string
  weekNumber: number
  difficulty: string
  completed?: boolean
  score?: number
}

export default function QuizCard({
  lessonId, roadmapId, topic, skill,
  weekNumber, difficulty, completed, score,
}: QuizCardProps) {
  const router = useRouter()

  const startQuiz = () => {
    const sp = new URLSearchParams({
      topic,
      skill,
      roadmap_id: roadmapId,
      lesson_id:  lessonId,
      difficulty,
      week:       String(weekNumber),
    })
    router.push(`/quiz/new?${sp}`)
  }

  const diffColor = {
    beginner:     'text-brand-green  border-brand-green/40',
    intermediate: 'text-brand-yellow border-brand-yellow/40',
    advanced:     'text-brand-red    border-brand-red/40',
  }[difficulty] || 'text-brand-muted border-brand-border'

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 hover:border-brand-blue/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-brand-text font-mono text-sm font-medium">{topic}</div>
          <div className="text-brand-muted font-mono text-xs mt-0.5">Quiz · Week {weekNumber}</div>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded border ${diffColor}`}>
          {difficulty}
        </span>
      </div>

      {completed && score !== undefined ? (
        <div className="flex items-center justify-between">
          <div className="text-brand-green font-mono text-sm">
            ✓ {score}% — Completed
          </div>
          <button
            onClick={startQuiz}
            className="text-brand-muted font-mono text-xs hover:text-brand-text transition-colors"
          >
            Retake →
          </button>
        </div>
      ) : (
        <button
          onClick={startQuiz}
          className="w-full bg-brand-blue/10 border border-brand-blue/30 text-brand-blue py-2.5 rounded-lg font-mono text-sm hover:bg-brand-blue/20 transition-colors"
        >
          Start Quiz →
        </button>
      )}
    </div>
  )
}