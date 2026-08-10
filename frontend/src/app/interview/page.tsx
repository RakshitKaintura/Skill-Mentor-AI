'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useMockInterview } from '@/hooks/useMockInterview'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'
import { useVapiInterview } from '@/hooks/useVapiInterview'
import { InterviewSetup } from '@/components/interview/InterviewSetup'
import { InterviewActiveSession } from '@/components/interview/InterviewActiveSession'
import { InterviewResults } from '@/components/interview/InterviewResults'

function InterviewPageContent() {
  const params = useSearchParams()
  const { user } = useAuth()
  const { track } = useAnalytics()

  const skill = params.get('skill') || ''
  const level = params.get('level') || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''

  const vapiState = useVapiInterview()

  const {
    mode, setMode,
    session, summary,
    currentQ, answer, setAnswer,
    evaluations, currentEval,
    loading, evaluating, finishing, phase,
    interviewType, setInterviewType,
    companyTarget, setCompanyTarget,
    numQuestions, setNumQuestions,
    startInterview, submitAnswer, nextQuestion, handleVocalComplete
  } = useMockInterview(
    user?.id, roadmapId, skill, level, track, vapiState
  )

  // ── Setup ─────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="min-h-screen page-tone-mint flex flex-col">
      <DashboardNavbar />
      <SectionContainer className="py-12 max-w-6xl flex-1">
        <div className="mb-10">
          <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-2">Agent 8 · Career Prep</div>
          <h1 className="font-display font-black text-4xl text-brand-text">Mock Interview</h1>
          <p className="text-brand-muted font-mono text-sm mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-brand-surface border border-brand-border text-brand-text">{skill}</span>
            <span className="text-brand-border">•</span>
            <span className="px-2 py-0.5 rounded bg-brand-surface border border-brand-border text-brand-text">{level}</span>
          </p>
        </div>

        <InterviewSetup
          skill={skill}
          level={level}
          mode={mode}
          setMode={setMode}
          interviewType={interviewType}
          setInterviewType={setInterviewType}
          companyTarget={companyTarget}
          setCompanyTarget={setCompanyTarget}
          numQuestions={numQuestions}
          setNumQuestions={setNumQuestions}
          loading={loading}
          startInterview={startInterview}
        />
      </SectionContainer>
    </div>
  )

  // ── Interview ─────────────────────────────────────────
  if (phase === 'interview' && session) return (
    <div className="min-h-screen page-tone-mint flex flex-col">
      <DashboardNavbar />
      <InterviewActiveSession
        mode={mode}
        session={session}
        currentQ={currentQ}
        answer={answer}
        setAnswer={setAnswer}
        evaluations={evaluations}
        currentEval={currentEval}
        evaluating={evaluating}
        finishing={finishing}
        submitAnswer={submitAnswer}
        nextQuestion={nextQuestion}
        vapiState={vapiState}
        handleVocalComplete={handleVocalComplete}
      />
    </div>
  )

  // ── Results ───────────────────────────────────────────
  if (phase === 'results' && summary) return (
    <div className="min-h-screen page-tone-mint flex flex-col">
      <DashboardNavbar />
      <InterviewResults 
        summary={summary} 
        roadmapId={roadmapId} 
        skill={skill} 
        level={level} 
      />
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