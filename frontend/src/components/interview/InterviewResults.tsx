import { useRouter } from 'next/navigation'
import SectionContainer from '@/components/ui/SectionContainer'
import type { InterviewSummary } from '@/types/week4'

interface InterviewResultsProps {
  summary: InterviewSummary
  roadmapId: string
  skill: string
  level: string
}

export function InterviewResults({ summary, roadmapId, skill, level }: InterviewResultsProps) {
  const router = useRouter()

  return (
    <SectionContainer className="py-16 max-w-3xl">
      <div className="text-center mb-14">
        <div className={`text-9xl font-display font-black mb-4 tracking-tighter ${
          summary.overall_score >= 75 ? 'text-brand-green' :
          summary.overall_score >= 55 ? 'text-brand-yellow' : 'text-brand-red'
        }`}>
          {summary.overall_score}<span className="text-4xl text-brand-muted">%</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className={`px-5 py-2 rounded-full border text-sm font-mono font-bold ${
            summary.job_ready
              ? 'border-brand-green/40 bg-brand-green/10 text-brand-green shadow-[0_0_15px_rgba(40,167,69,0.2)]'
              : 'border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow shadow-[0_0_15px_rgba(255,184,0,0.2)]'
          }`}>
            {summary.job_ready ? '✓ Job Ready!' : 'Keep Practising'}
          </div>
          <div className="px-5 py-2 rounded-full border border-brand-blue/40 bg-brand-blue/10 text-brand-blue text-sm font-mono font-bold">
            +{summary.xp_awarded} XP
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 shadow-sm">
          <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-4">Overall Feedback</div>
          <p className="text-brand-text text-base leading-relaxed">{summary.overall_feedback}</p>
        </div>

        <div className="bg-brand-surface border border-brand-green/20 rounded-3xl p-8 shadow-sm">
          <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-5">Strengths</div>
          <ul className="space-y-3">
            {summary.strengths.map((s, i) => (
              <li key={i} className="text-brand-text text-sm flex gap-3 items-start">
                <span className="text-brand-green mt-0.5">→</span> <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {summary.improvements.length > 0 && (
          <div className="bg-brand-surface border border-brand-yellow/20 rounded-3xl p-8 shadow-sm">
            <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-5">Areas to Improve</div>
            <div className="space-y-4">
              {summary.improvements.map((item, i) => (
                <div key={i} className="border border-brand-border bg-brand-bg/50 rounded-xl p-5">
                  <div className="text-brand-text text-sm font-medium mb-2">{item.area}</div>
                  <div className="text-brand-yellow text-sm font-mono">Action: {item.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-brand-surface border border-brand-blue/20 rounded-3xl p-8 shadow-sm">
          <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-5">Study Plan</div>
          <ol className="space-y-4">
            {summary.study_plan.map((s, i) => (
              <li key={i} className="text-brand-text text-sm flex gap-4 items-start">
                <span className="text-brand-blue font-mono font-bold bg-brand-blue/10 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="mt-0.5 leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="text-center py-8">
          <p className="text-brand-muted font-mono text-sm italic">&ldquo;{summary.encouragement}&rdquo;</p>
        </div>

        <div className="flex gap-4 pt-4 border-t border-brand-border/50">
          <button
            onClick={() => router.push(`/career?roadmap_id=${roadmapId}&skill=${skill}&level=${level}`)}
            className="flex-1 border-2 border-brand-border text-brand-text py-4 rounded-2xl font-mono font-bold text-sm hover:border-brand-yellow/40 hover:bg-brand-surface transition-all"
          >
            Practice Again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 bg-brand-yellow text-brand-bg py-4 rounded-2xl font-mono font-bold text-sm hover:bg-brand-yellow/90 transition-all shadow-lg shadow-brand-yellow/20"
          >
            Back to Dashboard →
          </button>
        </div>
      </div>
    </SectionContainer>
  )
}
