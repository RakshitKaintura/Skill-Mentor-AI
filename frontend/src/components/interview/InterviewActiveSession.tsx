import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import { VocalInterviewPanel } from '@/components/interview/VocalInterviewPanel'
import { VerdictBadge } from '@/components/ui/VerdictBadge'
import type { InterviewSession, AnswerEvaluation } from '@/types/week4'

type InterviewMode = 'typing' | 'vocal'

interface InterviewActiveSessionProps {
  mode: InterviewMode
  session: InterviewSession
  currentQ: number
  answer: string
  setAnswer: (a: string) => void
  evaluations: AnswerEvaluation[]
  currentEval: AnswerEvaluation | null
  evaluating: boolean
  finishing: boolean
  submitAnswer: () => void
  nextQuestion: () => void
  vapiState: any
  handleVocalComplete: () => void
}

export function InterviewActiveSession({
  mode,
  session,
  currentQ,
  answer,
  setAnswer,
  evaluations,
  currentEval,
  evaluating,
  finishing,
  submitAnswer,
  nextQuestion,
  vapiState,
  handleVocalComplete,
}: InterviewActiveSessionProps) {
  const q = session.questions[currentQ]

  return (
    <div className="flex-1 flex flex-col">
      {/* Progress bar (only for typing mode) */}
      {mode === 'typing' && (
        <div className="h-1 bg-brand-border flex-shrink-0">
          <div
            className="h-1 bg-brand-yellow transition-all duration-500"
            style={{ width: `${((currentQ + (currentEval ? 1 : 0)) / session.questions.length) * 100}%` }}
          />
        </div>
      )}

      {mode === 'vocal' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 py-8">
          {finishing ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Spinner />
              <p className="text-brand-yellow font-mono text-sm uppercase tracking-widest">
                Evaluating your interview...
              </p>
            </div>
          ) : (
            <VocalInterviewPanel 
              vapiState={vapiState} 
              onComplete={handleVocalComplete} 
            />
          )}
        </div>
      ) : (
        <SectionContainer className="py-12 max-w-3xl flex-1">
          {/* Question header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest">
                Question {currentQ + 1} of {session.questions.length}
              </div>
              {q && (
                <div className="text-xs font-mono text-brand-yellow mt-1">
                  {q.type} · {q.difficulty} · ~{q.expected_duration_mins} min
                </div>
              )}
            </div>
            <div className="text-brand-muted font-mono text-xs bg-brand-surface px-3 py-1 rounded-full border border-brand-border">
              {evaluations.length} answered
            </div>
          </div>

          {q && !currentEval && (
            <div className="space-y-8">
              {/* Question */}
              <div className="bg-brand-surface/60 border border-brand-yellow/30 rounded-2xl p-8 shadow-sm">
                <p className="text-brand-text text-lg leading-relaxed font-medium">{q.question}</p>
                {q.follow_up && (
                  <p className="text-brand-muted text-sm mt-4 italic">Follow-up: {q.follow_up}</p>
                )}
              </div>

              {/* Key points hint */}
              <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
                <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Key areas to cover</div>
                <ul className="space-y-2">
                  {q.key_points.map((kp, i) => (
                    <li key={i} className="text-brand-muted text-sm flex gap-3 items-start">
                      <span className="text-brand-border mt-0.5">→</span> <span>{kp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Answer input */}
              <div className="pt-2">
                <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3 block">
                  Your Answer
                </label>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Type your answer here... Be as detailed as possible."
                  rows={10}
                  className="w-full bg-brand-bg border border-brand-border rounded-2xl px-6 py-5 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-yellow/50 focus:ring-1 focus:ring-brand-yellow/30 resize-none shadow-inner"
                />
              </div>

              <button
                onClick={submitAnswer}
                disabled={evaluating || !answer.trim()}
                className="w-full bg-brand-yellow text-brand-bg py-5 rounded-2xl font-mono font-bold text-base hover:bg-brand-yellow/90 transition-all disabled:opacity-40 shadow-lg shadow-brand-yellow/20 mt-4"
              >
                {evaluating ? 'AI is evaluating…' : 'Submit Answer →'}
              </button>
            </div>
          )}

          {/* Evaluation feedback */}
          {currentEval && (
            <div className="space-y-6">
              <div className="flex items-center gap-6 bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-sm">
                <div className={`text-4xl font-display font-black ${
                  currentEval.score >= 80 ? 'text-brand-green' :
                  currentEval.score >= 60 ? 'text-brand-yellow' : 'text-brand-red'
                }`}>
                  {currentEval.score}<span className="text-xl text-brand-muted">/100</span>
                </div>
                <VerdictBadge verdict={currentEval.verdict} />
              </div>

              {currentEval.what_was_good && (
                <div className="bg-brand-green/5 border border-brand-green/20 rounded-2xl p-6 shadow-sm">
                  <div className="text-brand-green text-xs font-mono uppercase tracking-widest mb-3">What was good</div>
                  <p className="text-brand-text text-sm leading-relaxed">{currentEval.what_was_good}</p>
                </div>
              )}

              {currentEval.what_was_missing && (
                <div className="bg-brand-yellow/5 border border-brand-yellow/20 rounded-2xl p-6 shadow-sm">
                  <div className="text-brand-yellow text-xs font-mono uppercase tracking-widest mb-3">What was missing</div>
                  <p className="text-brand-text text-sm leading-relaxed">{currentEval.what_was_missing}</p>
                </div>
              )}

              <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-sm">
                <div className="text-brand-muted text-xs font-mono uppercase tracking-widest mb-3">Strong answer would include</div>
                <p className="text-brand-text text-sm leading-relaxed">{currentEval.ideal_answer_summary}</p>
              </div>

              <div className="pt-4">
                <button
                  onClick={nextQuestion}
                  disabled={finishing}
                  className="w-full bg-brand-text text-brand-bg py-5 rounded-2xl font-mono font-bold text-base hover:bg-white transition-all disabled:opacity-40 shadow-xl shadow-brand-text/10"
                >
                  {finishing ? 'Finalizing…' :
                    currentQ + 1 >= session.questions.length
                      ? '✓ Finish Interview'
                      : 'Next Question →'}
                </button>
              </div>
            </div>
          )}
        </SectionContainer>
      )}
    </div>
  )
}
