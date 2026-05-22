'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import { VocalInterviewPanel } from '@/components/interview/VocalInterviewPanel'
import { useVapiInterview } from '@/hooks/useVapiInterview'
import type {
  InterviewSession, AnswerEvaluation, InterviewSummary
} from '@/types/week4'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type InterviewMode = 'typing' | 'vocal'

function InterviewPageContent() {
  const params   = useSearchParams()
  const router   = useRouter()
  const { user } = useAuth()
  const { track } = useAnalytics()

  const [mode,         setMode]         = useState<InterviewMode>('typing')
  const [session,      setSession]      = useState<InterviewSession | null>(null)
  const [summary,      setSummary]      = useState<InterviewSummary | null>(null)
  const [currentQ,     setCurrentQ]     = useState(0)
  const [answer,       setAnswer]       = useState('')
  const [evaluations,  setEvaluations]  = useState<AnswerEvaluation[]>([])
  const [allAnswers,   setAllAnswers]   = useState<Array<{ question_id: number; answer: string }>>([])
  const [currentEval,  setCurrentEval]  = useState<AnswerEvaluation | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [evaluating,   setEvaluating]   = useState(false)
  const [finishing,    setFinishing]    = useState(false)
  const [phase,        setPhase]        = useState<'setup' | 'interview' | 'results'>('setup')

  // Setup form state
  const [interviewType,   setInterviewType]   = useState('technical')
  const [companyTarget,   setCompanyTarget]   = useState('')
  const [numQuestions,    setNumQuestions]    = useState(6)

  const skill     = params.get('skill')      || ''
  const level     = params.get('level')      || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  // Vapi Voice Hook
  const vapiState = useVapiInterview()

  const startInterview = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, roadmap_id: roadmapId,
          skill, level, interview_type: interviewType,
          company_target: companyTarget, num_questions: numQuestions,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSession(data.interview)
        setPhase('interview')
        
        // If mode is vocal, immediately start the Vapi call
        if (mode === 'vocal') {
          vapiState.startCall(data.interview)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // --- TYPING MODE SUBMISSION ---
  const submitAnswer = async () => {
    if (!session || !answer.trim()) return
    const q = session.questions[currentQ]
    setEvaluating(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/evaluate-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          question_id: q.id, question_text: q.question,
          answer, key_points: q.key_points,
          skill, level,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const evaluation = data.evaluation
        setCurrentEval(evaluation)
        setEvaluations(prev => [...prev, evaluation])
        setAllAnswers(prev => [...prev, { question_id: q.id, answer }])
      }
    } finally {
      setEvaluating(false)
    }
  }

  const nextQuestion = () => {
    setCurrentEval(null)
    setAnswer('')
    if (currentQ + 1 >= (session?.questions.length || 0)) {
      finishInterview()
    } else {
      setCurrentQ(prev => prev + 1)
    }
  }

  // --- VOCAL MODE COMPLETION ---
  const handleVocalComplete = async () => {
    if (!session || !user) return
    setFinishing(true)
    
    // Grab the full transcript from the vocal session
    const fullTranscript = vapiState.getTranscriptText()
    
    try {
      // Evaluate all questions sequentially using the entire transcript as context
      const newEvals: AnswerEvaluation[] = []
      const newAnswers: Array<{ question_id: number; answer: string }> = []
      
      for (const q of session.questions) {
        const res = await fetch(`${API}/api/career/interview/evaluate-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.session_id,
            question_id: q.id, question_text: q.question,
            answer: fullTranscript, // the backend AI will extract the relevant answer parts
            key_points: q.key_points,
            skill, level,
          }),
        })
        const data = await res.json()
        if (data.success) {
          newEvals.push(data.evaluation)
          newAnswers.push({ question_id: q.id, answer: fullTranscript })
        }
      }
      
      setEvaluations(newEvals)
      setAllAnswers(newAnswers)
      
      // Now finish the interview
      await finishInterview(newAnswers, newEvals)
      
    } catch (err) {
      console.error("Failed to process vocal interview", err)
    } finally {
      setFinishing(false)
    }
  }

  const finishInterview = async (passedAnswers = allAnswers, passedEvals = evaluations) => {
    if (!session || !user) return
    setFinishing(true)
    try {
      const res  = await fetch(`${API}/api/career/interview/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id, user_id: user.id,
          answers: passedAnswers, evaluations: passedEvals,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
        setPhase('results')
        void track('interview_completed', {
          page: '/interview',
          event_data: {
            session_id: session.session_id,
            skill,
            level,
            interview_type: interviewType,
            questions_count: session.questions.length,
            overall_score: data.summary?.overall_score,
            xp_awarded: data.summary?.xp_awarded,
            job_ready: data.summary?.job_ready,
            mode: mode
          },
        })
      }
    } finally {
      setFinishing(false)
    }
  }

  const verdictColor = (v: string) => {
    if (v === 'Excellent')   return 'text-brand-green border-brand-green/40 bg-brand-green/10'
    if (v === 'Good')        return 'text-brand-blue  border-brand-blue/40  bg-brand-blue/10'
    if (v === 'Needs Work')  return 'text-brand-yellow border-brand-yellow/40 bg-brand-yellow/10'
    return 'text-brand-red border-brand-red/40 bg-brand-red/10'
  }

  const q = session?.questions[currentQ]

  // ── Setup ─────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-screen page-tone-mint">
      <DashboardNavbar />
      <SectionContainer className="py-12 max-w-6xl">
        <div className="mb-10">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">Agent 8 · Career Prep</div>
          <h1 className="font-display font-black text-4xl text-brand-text">Mock Interview</h1>
          <p className="text-brand-muted font-mono text-sm mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-brand-surface border border-brand-border text-brand-text">{skill}</span>
            <span className="text-brand-border">•</span>
            <span className="px-2 py-0.5 rounded bg-brand-surface border border-brand-border text-brand-text">{level}</span>
          </p>
        </div>

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
      </SectionContainer>
    </div>
  )

  // ── Interview ─────────────────────────────────────────
  if (phase === 'interview' && session) return (
    <div className="min-h-screen page-tone-mint flex flex-col">
      <DashboardNavbar />

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
        // VOCAL INTERVIEW MODE
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
        // TYPING INTERVIEW MODE
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
                <div className={`text-sm font-mono px-4 py-1.5 rounded-full border ${verdictColor(currentEval.verdict)}`}>
                  {currentEval.verdict}
                </div>
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

  // ── Results ───────────────────────────────────────────
  if (phase === 'results' && summary) return (
    <div className="min-h-screen page-tone-mint">
      <DashboardNavbar />
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
    </div>
  )

  return (
    <div className="min-h-screen page-tone-mint flex items-center justify-center">
      <Spinner />
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-tone-mint flex items-center justify-center"><Spinner /></div>}>
      <InterviewPageContent />
    </Suspense>
  )
}