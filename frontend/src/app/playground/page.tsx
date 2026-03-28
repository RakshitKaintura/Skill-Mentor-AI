'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { usePlayground } from '@/hooks/usePlayground'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'

function PlaygroundPageContent() {
  const params  = useSearchParams()
  const router  = useRouter()
  const { user } = useAuth()
  const {
    challenge, code, setCode, result, hint,
    loading, evaluating, gettingHint, hintsUsed, error,
    generateChallenge, requestHint, evaluateCode,
  } = usePlayground()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [activeTab, setActiveTab] = useState<'challenge' | 'result' | 'hints'>('challenge')
  const [lineCount, setLineCount]  = useState(1)

  const topic     = params.get('topic')      || ''
  const skill     = params.get('skill')      || ''
  const roadmapId = params.get('roadmap_id') || ''
  const lessonId  = params.get('lesson_id')  || ''
  const difficulty = params.get('difficulty') || 'beginner'
  const language   = params.get('language')  || 'javascript'

  useEffect(() => {
    if (user && topic && skill && roadmapId && lessonId) {
      generateChallenge({ user_id: user.id, roadmap_id: roadmapId, lesson_id: lessonId, topic, skill, difficulty, language })
    }
  }, [user, topic, skill, roadmapId, lessonId, difficulty, language, generateChallenge])

  const visibleTab = result ? 'result' : hint ? 'hints' : activeTab

  const handleCodeChange = (val: string) => {
    setCode(val)
    setLineCount(val.split('\n').length)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end   = e.currentTarget.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  const diffColor = {
    beginner:     'text-brand-green border-brand-green/40 bg-brand-green/10',
    intermediate: 'text-brand-yellow border-brand-yellow/40 bg-brand-yellow/10',
    advanced:     'text-brand-red border-brand-red/40 bg-brand-red/10',
  }[challenge?.difficulty || 'beginner']

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center">
        <Spinner />
        <p className="text-brand-muted font-mono text-sm mt-4">Generating challenge…</p>
      </div>
    </div>
  )

  if (!challenge) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-muted font-mono text-sm">
        {error || 'No challenge loaded. Go back to a lesson.'}
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <DashboardNavbar />

      {/* Top bar */}
      <div className="border-b border-brand-border bg-brand-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-brand-muted font-mono text-xs hover:text-brand-text transition-colors"
          >
            ← Back
          </button>
          <div>
            <div className="text-brand-text font-mono text-sm font-medium">{challenge.title}</div>
            <div className="text-brand-muted font-mono text-xs">{topic} · {language}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-2 py-1 rounded border ${diffColor}`}>
            {challenge.difficulty}
          </span>
          <span className="text-brand-muted font-mono text-xs">
            ~{challenge.expected_time_minutes} min
          </span>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Code editor */}
        <div className="w-1/2 flex flex-col border-r border-brand-border">
          {/* Editor header */}
          <div className="px-4 py-2 bg-brand-surface border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-red/60" />
              <div className="w-3 h-3 rounded-full bg-brand-yellow/60" />
              <div className="w-3 h-3 rounded-full bg-brand-green/60" />
              <span className="text-brand-muted font-mono text-xs ml-2">solution.{language === 'python' ? 'py' : 'js'}</span>
            </div>
            <span className="text-brand-muted font-mono text-xs">Line {lineCount}</span>
          </div>

          {/* Editor */}
          <div className="flex flex-1 overflow-hidden">
            {/* Line numbers */}
            <div className="bg-brand-surface px-3 py-4 text-brand-muted font-mono text-xs select-none border-r border-brand-border min-w-[40px] text-right leading-6">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 bg-brand-bg text-brand-text font-mono text-sm p-4 resize-none outline-none leading-6 overflow-auto"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-brand-border bg-brand-surface px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => requestHint(user?.id || '')}
              disabled={gettingHint || hintsUsed >= 3}
              className="flex-1 border border-brand-yellow/40 text-brand-yellow py-2 rounded font-mono text-xs hover:bg-brand-yellow/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {gettingHint ? '…' : `💡 Hint (${hintsUsed}/3 used)`}
            </button>
            <button
              onClick={() => evaluateCode(user?.id || '')}
              disabled={evaluating || !code.trim()}
              className="flex-1 bg-brand-green text-brand-bg py-2 rounded font-mono text-xs font-bold hover:bg-brand-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {evaluating ? 'Evaluating…' : '▶ Run & Submit'}
            </button>
          </div>
        </div>

        {/* RIGHT — Panel */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-brand-border bg-brand-surface">
            {(['challenge', 'result', 'hints'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${
                  visibleTab === tab
                    ? 'text-brand-green border-b-2 border-brand-green'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                {tab === 'result' && result && (result.passed ? '✓ ' : '✗ ')}
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6 font-mono text-sm">

            {/* Challenge description */}
            {visibleTab === 'challenge' && (
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-brand-muted uppercase tracking-widest mb-3">Problem</div>
                  <p className="text-brand-text leading-relaxed text-sm whitespace-pre-wrap">
                    {challenge.description}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-brand-muted uppercase tracking-widest mb-3">Test Cases</div>
                  <div className="space-y-2">
                    {challenge.test_cases.map((tc, i) => (
                      <div key={i} className="bg-brand-surface border border-brand-border rounded p-3">
                        <div className="text-brand-muted text-xs mb-1">{tc.description}</div>
                        <div className="text-brand-yellow text-xs">Input: <span className="text-brand-text">{tc.input}</span></div>
                        <div className="text-brand-green text-xs">Expected: <span className="text-brand-text">{tc.expected_output}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {visibleTab === 'result' && result && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className={`text-4xl font-black mb-1 ${result.passed ? 'text-brand-green' : 'text-brand-red'}`}>
                    {result.passed ? '✓ PASSED' : '✗ FAILED'}
                  </div>
                  <div className="text-brand-muted text-xs">
                    {result.tests_passed}/{result.tests_total} tests passed
                    {result.passed && ` · +${result.xp_awarded} XP`}
                  </div>
                </div>

                {/* Test results */}
                <div className="space-y-2">
                  {result.test_results.map((tr, i) => (
                    <div key={i} className={`p-3 rounded border ${tr.passed ? 'border-brand-green/30 bg-brand-green/5' : 'border-brand-red/30 bg-brand-red/5'}`}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-brand-text">{tr.description}</span>
                        <span className={tr.passed ? 'text-brand-green' : 'text-brand-red'}>
                          {tr.passed ? '✓' : '✗'}
                        </span>
                      </div>
                      {!tr.passed && (
                        <div className="text-xs space-y-1">
                          <div className="text-brand-red">Got: {tr.actual_output}</div>
                          <div className="text-brand-green">Expected: {tr.expected_output}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Code quality */}
                <div>
                  <div className="text-xs text-brand-muted uppercase tracking-widest mb-2">Code Quality: {result.code_quality.score}/100</div>
                  <div className="space-y-1">
                    {result.code_quality.comments.map((c, i) => (
                      <div key={i} className="text-brand-muted text-xs">→ {c}</div>
                    ))}
                  </div>
                </div>

                {/* AI feedback */}
                <div className="bg-brand-surface border border-brand-border rounded p-4">
                  <div className="text-xs text-brand-blue uppercase tracking-widest mb-2">AI Feedback</div>
                  <p className="text-brand-text text-xs leading-relaxed">{result.overall_feedback}</p>
                  {!result.passed && result.feedback.what_to_improve && (
                    <p className="text-brand-yellow text-xs mt-2 leading-relaxed">
                      Tip: {result.feedback.what_to_improve}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hints */}
            {visibleTab === 'hints' && (
              <div className="space-y-4">
                <div className="text-xs text-brand-muted uppercase tracking-widest">
                  Hints ({hintsUsed}/3 revealed · -10 XP each)
                </div>

                {hintsUsed === 0 && (
                  <div className="text-brand-muted text-sm">
                    Stuck? Click &quot;Hint&quot; in the editor to get a personalized nudge without spoiling the answer.
                  </div>
                )}

                {hint && (
                  <div className="bg-brand-surface border border-brand-yellow/30 rounded-lg p-4">
                    <div className="text-brand-yellow text-xs uppercase tracking-widest mb-2">
                      💡 Level {hint.hint_level} Hint
                    </div>
                    <p className="text-brand-text text-sm leading-relaxed">{hint.hint}</p>
                    <p className="text-brand-green text-xs mt-3">{hint.encouragement}</p>
                  </div>
                )}

                {/* All available hint levels */}
                {challenge.hints
                  .filter(h => h.level > hintsUsed)
                  .map(h => (
                    <div key={h.level} className="border border-brand-border rounded p-4 opacity-40">
                      <div className="text-brand-muted text-xs">Level {h.level} hint — locked</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg flex items-center justify-center"><Spinner /></div>}>
      <PlaygroundPageContent />
    </Suspense>
  )
}