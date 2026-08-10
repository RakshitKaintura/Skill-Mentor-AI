
type InterviewMode = 'typing' | 'vocal'

interface InterviewSetupProps {
  skill: string
  level: string
  mode: InterviewMode
  setMode: (m: InterviewMode) => void
  interviewType: string
  setInterviewType: (t: string) => void
  companyTarget: string
  setCompanyTarget: (c: string) => void
  numQuestions: number
  setNumQuestions: (n: number) => void
  loading: boolean
  startInterview: () => void
}

export function InterviewSetup({
  mode,
  setMode,
  interviewType,
  setInterviewType,
  companyTarget,
  setCompanyTarget,
  numQuestions,
  setNumQuestions,
  loading,
  startInterview,
}: InterviewSetupProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* Left Column - Form */}
      <div className="flex-1 w-full max-w-2xl space-y-8">
        {/* Mode Toggle */}
        <div className="bg-brand-surface/60 border border-brand-border rounded-2xl p-6 shadow-sm">
          <label className="text-xs font-mono text-brand-text uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-brand-blue/20 text-brand-blue flex items-center justify-center text-xs font-bold">1</span>
            Interaction Mode
          </label>
          <div className="flex bg-brand-bg p-1.5 rounded-xl border border-brand-border/50">
            <button
              onClick={() => setMode('typing')}
              className={`flex-1 py-3 rounded-lg font-mono text-sm font-bold transition-all ${
                mode === 'typing' 
                  ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' 
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              📝 Typing
            </button>
            <button
              onClick={() => setMode('vocal')}
              className={`flex-1 py-3 rounded-lg font-mono text-sm font-bold transition-all ${
                mode === 'vocal' 
                  ? 'bg-brand-green text-black shadow-md shadow-brand-green/20' 
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              🎤 Vocal (Live)
            </button>
          </div>
        </div>

        <div className="bg-brand-surface/60 border border-brand-border rounded-2xl p-6 space-y-8 shadow-sm">
          <label className="text-xs font-mono text-brand-text uppercase tracking-widest flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-brand-yellow/20 text-brand-yellow flex items-center justify-center text-xs font-bold">2</span>
            Interview Details
          </label>
          
          <div className="pl-8 space-y-8">
            <div>
              <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3 block">Focus Area</label>
              <div className="grid grid-cols-2 gap-3">
                {(['technical', 'behavioral', 'mixed', 'system_design'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setInterviewType(t)}
                    className={`py-3 rounded-xl border font-mono text-sm transition-all ${
                      interviewType === t
                        ? 'border-brand-yellow bg-brand-yellow/10 text-brand-yellow shadow-sm'
                        : 'border-brand-border text-brand-muted hover:border-brand-yellow/40 bg-brand-bg/50'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3 block">
                Target Company <span className="text-brand-border opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                value={companyTarget}
                onChange={e => setCompanyTarget(e.target.value)}
                placeholder="e.g. Google, Amazon, startup"
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3.5 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-yellow/50 transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-mono text-brand-muted uppercase tracking-widest block">
                  Number of Questions
                </label>
                <span className="text-brand-yellow font-mono text-sm font-bold bg-brand-yellow/10 px-3 py-1 rounded-md">{numQuestions}</span>
              </div>
              <input
                type="range" min={4} max={12} value={numQuestions}
                onChange={e => setNumQuestions(parseInt(e.target.value))}
                className="w-full accent-brand-yellow"
              />
              <div className="flex justify-between text-[10px] font-mono text-brand-muted mt-2">
                <span>4 (Quick Practice)</span><span>12 (Full Interview)</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={startInterview}
          disabled={loading}
          className="w-full bg-brand-text text-brand-bg py-5 rounded-2xl font-mono font-bold text-base hover:bg-white transition-all disabled:opacity-50 shadow-xl shadow-brand-text/10"
        >
          {loading ? 'Generating questions…' : mode === 'vocal' ? '🎤 Start Vocal Interview' : '⌨️ Start Typing Interview'}
        </button>
      </div>

      {/* Right Column - Info Panel */}
      <div className="hidden lg:block w-[380px] flex-shrink-0">
        <div className="sticky top-24 bg-gradient-to-br from-brand-surface to-brand-bg border border-brand-border rounded-3xl p-8 shadow-2xl">
          
          <div className="w-14 h-14 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-center mb-6 shadow-inner">
            {mode === 'vocal' ? <span className="text-2xl">🎤</span> : <span className="text-2xl">⌨️</span>}
          </div>

          <h3 className="font-display font-black text-2xl text-brand-text mb-3">
            {mode === 'vocal' ? 'Live Vocal Session' : 'Typing Session'}
          </h3>
          
          <p className="text-brand-muted text-sm leading-relaxed mb-8">
            {mode === 'vocal' 
              ? 'Speak your answers clearly using your microphone. The AI interviewer will ask questions out loud and guide the session naturally, just like a real video call.'
              : 'Take your time to type out thoughtful answers. Perfect for practicing structured responses, code snippets, and system design explanations.'}
          </p>

          <div className="space-y-5 bg-brand-surface/40 p-5 rounded-2xl border border-brand-border/50">
            <div className="flex items-start gap-4">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-yellow flex-shrink-0 shadow-[0_0_8px_rgba(255,184,0,0.5)]" />
              <div>
                <div className="text-[10px] font-mono text-brand-muted uppercase tracking-widest">Focus Area</div>
                <div className="text-brand-text text-sm font-medium capitalize mt-0.5">{interviewType.replace('_', ' ')}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-blue flex-shrink-0 shadow-[0_0_8px_rgba(0,123,255,0.5)]" />
              <div>
                <div className="text-[10px] font-mono text-brand-muted uppercase tracking-widest">Format</div>
                <div className="text-brand-text text-sm font-medium mt-0.5">{numQuestions} Questions (~{numQuestions * 3} mins)</div>
              </div>
            </div>

            {companyTarget && (
              <div className="flex items-start gap-4">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-green flex-shrink-0 shadow-[0_0_8px_rgba(40,167,69,0.5)]" />
                <div>
                  <div className="text-[10px] font-mono text-brand-muted uppercase tracking-widest">Target</div>
                  <div className="text-brand-text text-sm font-medium mt-0.5">{companyTarget} standard</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-brand-border/50">
            <div className="flex items-center gap-3 text-xs font-mono text-brand-muted">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-green"></span>
              </span>
              AI Interviewer Ready
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
