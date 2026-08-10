import { useState, useCallback } from 'react'
import { CareerService } from '@/services/career.service'
import type { InterviewSession, AnswerEvaluation, InterviewSummary } from '@/types/week4'

type InterviewMode = 'typing' | 'vocal'

export function useMockInterview(
  userId: string | undefined,
  roadmapId: string,
  skill: string,
  level: string,
  track: (event: string, data: any) => void,
  vapiState: any
) {
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

  const startInterview = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await CareerService.startInterview({
          user_id: userId, roadmap_id: roadmapId,
          skill, level, interview_type: interviewType,
          company_target: companyTarget, num_questions: numQuestions,
      })
      if (data.success) {
        setSession(data.interview)
        setPhase('interview')
        if (mode === 'vocal') {
          vapiState.startCall(data.interview)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [userId, roadmapId, skill, level, interviewType, companyTarget, numQuestions, mode, vapiState])

  const submitAnswer = useCallback(async () => {
    if (!session || !answer.trim()) return
    const q = session.questions[currentQ]
    setEvaluating(true)
    try {
      const data = await CareerService.evaluateAnswer({
          session_id: session.session_id,
          question_id: q.id, question_text: q.question,
          answer, key_points: q.key_points,
          skill, level,
      })
      if (data.success) {
        const evaluation = data.evaluation
        setCurrentEval(evaluation)
        setEvaluations(prev => [...prev, evaluation])
        setAllAnswers(prev => [...prev, { question_id: q.id, answer }])
      }
    } finally {
      setEvaluating(false)
    }
  }, [session, answer, currentQ, skill, level])

  const finishInterview = useCallback(async (passedAnswers = allAnswers, passedEvals = evaluations) => {
    if (!session || !userId) return
    setFinishing(true)
    try {
      const data = await CareerService.completeInterview({
          session_id: session.session_id, user_id: userId,
          answers: passedAnswers, evaluations: passedEvals,
      })
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
  }, [session, userId, allAnswers, evaluations, track, skill, level, interviewType, mode])

  const nextQuestion = useCallback(() => {
    setCurrentEval(null)
    setAnswer('')
    if (currentQ + 1 >= (session?.questions.length || 0)) {
      void finishInterview()
    } else {
      setCurrentQ(prev => prev + 1)
    }
  }, [currentQ, session, finishInterview])

  const handleVocalComplete = useCallback(async () => {
    if (!session || !userId) return
    setFinishing(true)
    const fullTranscript = vapiState.getTranscriptText()
    try {
      const newEvals: AnswerEvaluation[] = []
      const newAnswers: Array<{ question_id: number; answer: string }> = []
      
      for (const q of session.questions) {
        const data = await CareerService.evaluateAnswer({
            session_id: session.session_id,
            question_id: q.id, question_text: q.question,
            answer: fullTranscript,
            key_points: q.key_points,
            skill, level,
        })
        if (data.success) {
          newEvals.push(data.evaluation)
          newAnswers.push({ question_id: q.id, answer: fullTranscript })
        }
      }
      
      setEvaluations(newEvals)
      setAllAnswers(newAnswers)
      await finishInterview(newAnswers, newEvals)
      
    } catch (err) {
      console.error("Failed to process vocal interview", err)
    } finally {
      setFinishing(false)
    }
  }, [session, userId, vapiState, skill, level, finishInterview])

  return {
    mode, setMode,
    session, summary,
    currentQ, answer, setAnswer,
    evaluations, currentEval,
    loading, evaluating, finishing, phase,
    interviewType, setInterviewType,
    companyTarget, setCompanyTarget,
    numQuestions, setNumQuestions,
    startInterview, submitAnswer, nextQuestion, handleVocalComplete
  }
}
