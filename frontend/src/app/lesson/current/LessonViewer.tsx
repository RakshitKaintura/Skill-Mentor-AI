'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLesson } from '@/hooks/useLesson'
import { useVoice } from '@/hooks/useVoice'
import { createClient } from '@/lib/supabase/client'
import { LessonStepCard } from '@/components/lesson/LessonStepCard'
import { DoubtPanel } from '@/components/lesson/DoubtPanel'
import { VoiceOrb } from '@/components/voice/VoiceOrb'
import { VoiceTranscript } from '@/components/voice/VoiceTranscript'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Mic, MessageCircle, FileText,
  CheckCircle, Loader2, BookOpen, ChevronLeft, ChevronRight, Volume2, Pause, Play, Send
} from 'lucide-react'

interface Props {
  roadmapId:        string
  topic:            string
  skill:            string
  level:            string
  phaseName:        string
  weekNumber:       number
  existingLessonId: string | null
  userName:         string
}

type PanelMode = 'lesson' | 'voice' | 'doubt'

interface DoubtResult {
  answer:       string
  analogy:      string
  code_example: string | null
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export function LessonViewer({
  roadmapId, topic, skill, level, phaseName, weekNumber, existingLessonId, userName
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const toast  = useToast()

  const { lesson, loading, error, generating, generateLesson, fetchLesson, completeLesson, generateNotes } = useLesson()
  const voice = useVoice({ topic, skill, level,
    lessonContext: lesson?.steps.map(s => `${s.title}: ${s.content}`).join('\n') })

  const [activeStep, setActiveStep]     = useState(0)
  const [panel, setPanel]               = useState<PanelMode>('lesson')
  const [notesLoading, setNotesLoading] = useState(false)
  const [completing, setCompleting]     = useState(false)
  const [startTime]                     = useState(Date.now())
  const [voiceDoubtLoading, setVoiceDoubtLoading] = useState(false)
  const [voiceDoubtError, setVoiceDoubtError] = useState<string | null>(null)
  const [voiceDoubtQuestion, setVoiceDoubtQuestion] = useState('')
  const [voiceDoubtResult, setVoiceDoubtResult] = useState<DoubtResult | null>(null)
  const [voiceTextInput, setVoiceTextInput] = useState('')
    const getResumePrompt = (question?: string, result?: DoubtResult | null) => {
      const q = question ?? voiceDoubtQuestion
      const r = result ?? voiceDoubtResult

      if (!q || !r) {
        return 'Please continue the lesson from where we paused.'
      }

      return [
        `Resume the lesson on ${topic}.`,
        `The learner just asked this doubt: "${q}".`,
        `You answered it with: "${r.answer}".`,
        'Now continue from the exact point we paused in short spoken-friendly steps, and ask one quick checkpoint question.',
      ].join(' ')
    }

  const [capturingDoubt, setCapturingDoubt] = useState(false)
  const [autoSpeakDoubt, setAutoSpeakDoubt] = useState(true)
  const [speakingDoubt, setSpeakingDoubt] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    if (existingLessonId) fetchLesson(existingLessonId)
    else generateLesson({ roadmap_id: roadmapId, topic, skill, level, phase_name: phaseName, week_number: weekNumber })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const stopDoubtSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setSpeakingDoubt(false)
  }

  const speakDoubtAnswer = (result: DoubtResult, resumePrompt?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const speechText = `Here is your doubt answer. ${result.answer} Analogy: ${result.analogy}`
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setSpeakingDoubt(true)
    utterance.onend = () => {
      setSpeakingDoubt(false)
      if (voice.state !== 'idle') {
        voice.resume(resumePrompt)
      }
    }
    utterance.onerror = () => setSpeakingDoubt(false)
    window.speechSynthesis.speak(utterance)
  }

  const handleComplete = async () => {
    if (!lesson || completing) return
    setCompleting(true)
    const mins = Math.round((Date.now() - startTime) / 60000)
    await completeLesson(lesson.id, mins)
    toast.success('Lesson completed! +100 XP 🎉')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const handleGenerateNotes = async () => {
    if (!lesson) return

    // Open immediately on user gesture to avoid popup blockers after async work.
    const popup = window.open('about:blank', '_blank')
    if (!popup) {
      toast.error('Popup blocked. Please allow popups for this site to download notes.')
      return
    }

    try {
      popup.document.title = 'Preparing notes...'
      popup.document.body.style.margin = '0'
      popup.document.body.style.fontFamily = 'system-ui, sans-serif'
      popup.document.body.style.display = 'grid'
      popup.document.body.style.placeItems = 'center'
      popup.document.body.style.minHeight = '100vh'
      popup.document.body.innerHTML = '<div style="color:#6B7A99;font-size:14px;">Preparing your PDF notes...</div>'
    } catch {
      // Some browsers may restrict document writes; navigation fallback below still handles download.
    }

    if (lesson.pdf_notes_url) {
      const existingUrl = lesson.pdf_notes_url.trim()
      popup.location.replace(existingUrl)
      toast.success('Opening your PDF notes…')
      return
    }

    setNotesLoading(true)
    const url = await generateNotes(lesson.id)
    setNotesLoading(false)

    if (url) {
      const pdfUrl = url.trim()
      try {
        popup.location.replace(pdfUrl)
      } catch {
        // Fallback for restrictive browser settings.
        window.location.href = pdfUrl
      }
      toast.success('PDF notes ready! 📄')
      return
    }

    popup.close()
    toast.error('Failed to generate notes.')
  }

  const askDoubt = async (question: string) => {
    setVoiceDoubtLoading(true)
    setVoiceDoubtError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lesson/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          lesson_id: lesson.id,
          topic,
          skill,
          question,
        }),
      })

      if (!res.ok) throw new Error('Failed to get doubt answer')

      const data: DoubtResult = await res.json()
      const resumePrompt = getResumePrompt(question, data)
      setVoiceDoubtQuestion(question)
      setVoiceDoubtResult(data)
      if (autoSpeakDoubt) {
        speakDoubtAnswer(data, resumePrompt)
      } else if (voice.state !== 'idle') {
        voice.resume(resumePrompt)
      }
      toast.success('Doubt answered. Resume voice whenever you are ready.')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to ask doubt'
      setVoiceDoubtError(message)
      toast.error(message)
    } finally {
      setVoiceDoubtLoading(false)
    }
  }

  const handleTextDoubtStart = (question: string) => {
    setVoiceDoubtQuestion(question)
    setVoiceDoubtResult(null)
    if (voice.state !== 'idle' && !voice.isPaused) {
      stopDoubtSpeech()
      voice.pause()
    }
  }

  const handleTextDoubtComplete = (question: string, result: DoubtResult) => {
    const resumePrompt = getResumePrompt(question, result)
    setVoiceDoubtQuestion(question)
    setVoiceDoubtResult(result)

    if (voice.state !== 'idle') {
      voice.resume(resumePrompt)
      toast.success('Doubt answered. Voice lesson resumed automatically.')
    }
  }

  const handlePanelChange = (mode: PanelMode) => {
    setPanel(mode)
    if (mode === 'doubt' && voice.state !== 'idle' && !voice.isPaused) {
      stopDoubtSpeech()
      voice.pause()
    }
  }

  const sendTypedVoiceInput = () => {
    const text = voiceTextInput.trim()
    if (!text) return

    if (voice.state === 'idle' || voice.state === 'error') {
      toast.error('Start the voice session first, then type your response or question.')
      return
    }

    stopDoubtSpeech()
    if (voice.isPaused) {
      voice.resume(text)
    } else {
      voice.sendText(text)
    }
    setVoiceTextInput('')
  }

  const startVoiceDoubtCapture = () => {
    if (typeof window === 'undefined') return

    type SpeechWindow = Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
      SpeechRecognition?: new () => SpeechRecognitionLike
    }

    const speechWindow = window as SpeechWindow
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setVoiceDoubtError('Voice doubt capture is not supported in this browser.')
      return
    }

    if (voice.state !== 'idle' && !voice.isPaused) {
      voice.pause()
    }

    recognitionRef.current?.stop()
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (!transcript) {
        setVoiceDoubtError('Could not hear your question clearly. Please try again.')
        return
      }
      void askDoubt(transcript)
    }

    recognition.onerror = (event) => {
      setVoiceDoubtError(`Voice capture failed: ${event.error}`)
    }

    recognition.onend = () => {
      setCapturingDoubt(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setVoiceDoubtError(null)
    setCapturingDoubt(true)
    recognition.start()
  }

  const steps      = lesson?.steps ?? []
  const totalSteps = steps.length
  const isLast     = activeStep === totalSteps - 1
  const actionLessonId = lesson?.id ?? existingLessonId ?? ''
  const sessionParams = new URLSearchParams({
    topic,
    skill,
    roadmap_id: roadmapId,
    lesson_id: actionLessonId,
    difficulty: level || 'beginner',
    language: 'javascript',
    week: String(weekNumber),
  })
  const quizHref = `/quiz/new?${sessionParams.toString()}`
  const playgroundHref = `/playground?${sessionParams.toString()}`
  const reportHref = `/report?roadmap_id=${encodeURIComponent(roadmapId)}&week=${weekNumber}`
  const reviewHref = `/review?roadmap_id=${encodeURIComponent(roadmapId)}`
  const leaderboardHref = '/leaderboard'

  // ── Loading ──────────────────────────────────────────────
  if (generating || loading) {
    return (
      <div className="min-h-screen">
        <DashboardNavbar userName={userName} />
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: '#4FFFA0', background: 'rgba(79,255,160,0.08)' }}>
              <span className="text-3xl">🧠</span>
            </div>
            <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-20"
              style={{ borderColor: '#4FFFA0' }} />
          </div>
          <div className="text-center">
            <h2 className="font-display font-black text-2xl mb-2" style={{ letterSpacing: '-0.5px' }}>
              {generating ? 'Preparing your lesson…' : 'Loading lesson…'}
            </h2>
            <p className="text-sm" style={{ color: '#6B7A99' }}>
              {generating ? 'Gemini 3.1 Flash Lite Preview is crafting content just for you' : 'Fetching saved lesson'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────
  if (error || !lesson) {
    return (
      <div className="min-h-screen">
        <DashboardNavbar userName={userName} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <div className="text-5xl mb-2">😔</div>
          <h2 className="font-display font-black text-2xl">Lesson generation failed</h2>
          <p className="text-sm max-w-md" style={{ color: '#6B7A99' }}>{error ?? 'Something went wrong.'}</p>
          <button
            onClick={() => generateLesson({ roadmap_id: roadmapId, topic, skill, level, phase_name: phaseName, week_number: weekNumber })}
            className="flex items-center gap-2 px-6 py-3 rounded-sm font-display font-bold text-sm"
            style={{ background: '#4FFFA0', color: '#080B14' }}>
            Try Again
          </button>
          <Link href="/dashboard" className="text-sm underline" style={{ color: '#6B7A99' }}>Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <DashboardNavbar userName={userName} />

      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Breadcrumb + Actions */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
              style={{ color: '#6B7A99' }}><ArrowLeft size={12} /> Dashboard</Link>
            <span style={{ color: '#1E2A42' }}>/</span>
            <span className="text-xs" style={{ color: '#6B7A99' }}>{phaseName}</span>
            <span style={{ color: '#1E2A42' }}>/</span>
            <span className="text-xs truncate">{topic}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleGenerateNotes} disabled={notesLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs border transition-all disabled:opacity-50"
              style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
              {notesLoading ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              {lesson.pdf_notes_url ? 'Download Notes' : 'Generate Notes'}
            </button>
            {!lesson.completed ? (
              <button onClick={handleComplete} disabled={completing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold disabled:opacity-50"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
                {completing ? <><Loader2 size={11} className="animate-spin" />Completing…</> : <><CheckCircle size={11} />Mark Complete</>}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold"
                style={{ background: 'rgba(79,255,160,0.1)', color: '#4FFFA0', border: '1px solid rgba(79,255,160,0.3)' }}>
                <CheckCircle size={11} /> Completed
              </div>
            )}
          </div>
        </div>

        {/* Lesson Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(79,255,160,0.1)', color: '#4FFFA0', border: '1px solid rgba(79,255,160,0.2)' }}>
              Week {weekNumber}
            </span>
            <span className="text-xs" style={{ color: '#6B7A99' }}>{phaseName}</span>
          </div>
          <h1 className="font-display font-black text-3xl" style={{ letterSpacing: '-1px' }}>{topic}</h1>
          {lesson.key_takeaway && (
            <p className="mt-2 text-sm" style={{ color: '#6B7A99' }}>{lesson.key_takeaway}</p>
          )}
          <div className="flex items-center gap-1 mt-4">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setActiveStep(i)}
                className="flex-1 h-1 rounded-full transition-all"
                style={{ background: i <= activeStep ? '#4FFFA0' : '#1E2A42', maxWidth: 60 }} />
            ))}
            <span className="text-xs ml-2" style={{ color: '#6B7A99' }}>{activeStep + 1}/{totalSteps}</span>
          </div>
        </div>

        {/* Learning Actions */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Link href={quizHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
            Start Quiz
          </Link>
          <Link href={playgroundHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
            Start Challenge
          </Link>
          <Link href={reportHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
            Weekly Report
          </Link>
          <Link href={reviewHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
            Review Queue
          </Link>
          <Link href={leaderboardHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
            Leaderboard
          </Link>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-0 mb-6 border rounded-sm overflow-hidden"
          style={{ borderColor: '#1E2A42', width: 'fit-content' }}>
          {[
            { mode: 'lesson' as PanelMode, icon: BookOpen,      label: 'Read'      },
            { mode: 'voice'  as PanelMode, icon: Mic,           label: 'Voice'     },
            { mode: 'doubt'  as PanelMode, icon: MessageCircle, label: 'Ask Doubt' },
          ].map(({ mode, icon: Icon, label }) => (
            <button key={mode} onClick={() => handlePanelChange(mode)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs transition-all"
              style={{
                background: panel === mode ? 'rgba(79,255,160,0.08)' : '#0E1420',
                color:      panel === mode ? '#4FFFA0' : '#6B7A99',
                borderRight: '1px solid #1E2A42',
              }}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* LESSON PANEL */}
        {panel === 'lesson' && (
          <div>
            <div className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <LessonStepCard key={i} step={step} index={i}
                  isActive={i === activeStep} onClick={() => setActiveStep(i)} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-sm text-sm border disabled:opacity-30 transition-all"
                style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs" style={{ color: '#6B7A99' }}>Step {activeStep + 1} of {totalSteps}</span>
              {isLast ? (
                <button onClick={handleComplete} disabled={completing || lesson.completed}
                  className="flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-bold disabled:opacity-50"
                  style={{ background: '#4FFFA0', color: '#080B14' }}>
                  {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Complete Lesson
                </button>
              ) : (
                <button onClick={() => setActiveStep(Math.min(totalSteps - 1, activeStep + 1))}
                  className="flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-bold"
                  style={{ background: '#4FFFA0', color: '#080B14' }}>
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
            {lesson.sources_used.length > 0 && (
              <div className="mt-6 p-4 rounded-sm" style={{ background: '#0E1420', border: '1px solid #1E2A42' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#6B7A99' }}>SOURCES USED</p>
                <div className="flex flex-wrap gap-2">
                  {lesson.sources_used.map((src, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-sm"
                      style={{ background: '#141B2D', color: '#6B7A99', border: '1px solid #1E2A42' }}>
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VOICE PANEL */}
        {panel === 'voice' && (
          <div className="max-w-xl mx-auto">
            <div className="glass-card p-8 text-center mb-4"
              style={{ borderColor: voice.state !== 'idle' ? 'rgba(79,255,160,0.2)' : '#1E2A42' }}>
              <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>
                {voice.state === 'idle'
                  ? `Start a voice session — AI will teach "${topic}" out loud. Interrupt anytime.`
                  : 'Voice session active. Speak naturally — interrupt anytime.'}
              </p>
              <VoiceOrb state={voice.state} isMuted={voice.isMuted}
                onStart={voice.start} onStop={voice.stop} onMuteToggle={voice.toggleMute}
                durationSeconds={voice.durationSeconds} />

              {voice.state !== 'idle' && voice.state !== 'error' && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (voice.isPaused) {
                        stopDoubtSpeech()
                        voice.resume(getResumePrompt())
                      } else {
                        voice.pause()
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border transition-all"
                    style={{
                      borderColor: voice.isPaused ? '#4FFFA0' : '#FFD166',
                      color: voice.isPaused ? '#4FFFA0' : '#FFD166',
                      background: voice.isPaused ? 'rgba(79,255,160,0.08)' : 'rgba(255,209,102,0.08)',
                    }}
                  >
                    {voice.isPaused ? <><Play size={12} />Resume Lesson</> : <><Pause size={12} />Pause Lesson</>}
                  </button>

                  <button
                    onClick={startVoiceDoubtCapture}
                    disabled={capturingDoubt || voiceDoubtLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border transition-all disabled:opacity-50"
                    style={{ borderColor: '#5B8EFF', color: '#5B8EFF', background: 'rgba(91,142,255,0.08)' }}
                  >
                    {capturingDoubt || voiceDoubtLoading
                      ? <><Loader2 size={12} className="animate-spin" />Listening for doubt…</>
                      : <><Mic size={12} />Ask Doubt by Voice</>}
                  </button>

                  <button
                    onClick={() => setAutoSpeakDoubt(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border transition-all"
                    style={{
                      borderColor: autoSpeakDoubt ? '#C77DFF' : '#1E2A42',
                      color: autoSpeakDoubt ? '#C77DFF' : '#6B7A99',
                      background: autoSpeakDoubt ? 'rgba(199,125,255,0.08)' : 'transparent',
                    }}
                  >
                    {autoSpeakDoubt ? 'Auto Speak: On' : 'Auto Speak: Off'}
                  </button>
                </div>
              )}

              {(capturingDoubt || voiceDoubtLoading) && (
                <p className="mt-3 text-xs" style={{ color: '#6B7A99' }}>
                  {capturingDoubt ? 'Speak your doubt now. We will pause the lesson and capture your question.' : 'Generating answer for your spoken doubt…'}
                </p>
              )}

              <div className="mt-5 text-left">
                <p className="text-xs font-bold mb-2" style={{ color: '#6B7A99' }}>
                  TYPE RESPONSE / QUESTION (Fallback)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voiceTextInput}
                    onChange={(e) => setVoiceTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendTypedVoiceInput()}
                    placeholder="Type if voice misses your input..."
                    className="flex-1 px-4 py-2.5 text-sm rounded-sm"
                    style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
                  />
                  <button
                    onClick={sendTypedVoiceInput}
                    disabled={!voiceTextInput.trim()}
                    className="px-4 py-2.5 rounded-sm flex items-center gap-2 text-sm font-bold disabled:opacity-40 transition-opacity"
                    style={{ background: '#5B8EFF', color: '#080B14' }}
                  >
                    <Send size={14} />
                    Send
                  </button>
                </div>
                <p className="mt-2 text-[11px]" style={{ color: '#6B7A99' }}>
                  Works while voice is active and also resumes session automatically if it was paused.
                </p>
              </div>

              {voiceDoubtError && <p className="mt-3 text-xs" style={{ color: '#FF6B6B' }}>{voiceDoubtError}</p>}
              {voice.error && <p className="mt-4 text-xs" style={{ color: '#FF6B6B' }}>{voice.error}</p>}
            </div>

            {voiceDoubtResult && (
              <div className="glass-card p-5 mb-4 space-y-4">
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#6B7A99' }}>YOUR VOICE DOUBT</p>
                  <p className="text-sm" style={{ color: '#C4CFEA' }}>{voiceDoubtQuestion}</p>
                </div>
                <div className="p-4 rounded-sm" style={{ background: '#141B2D', border: '1px solid #1E2A42' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#4FFFA0' }}>EXPLANATION</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#C4CFEA' }}>{voiceDoubtResult.answer}</p>
                </div>
                <div className="p-4 rounded-sm" style={{ background: 'rgba(255,209,102,0.06)', border: '1px solid rgba(255,209,102,0.2)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#FFD166' }}>ANALOGY</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#C4CFEA' }}>{voiceDoubtResult.analogy}</p>
                </div>
                <div className="flex justify-end">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => speakDoubtAnswer(voiceDoubtResult)}
                      className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border"
                      style={{ borderColor: '#5B8EFF', color: '#5B8EFF', background: 'rgba(91,142,255,0.08)' }}
                    >
                      <Play size={12} />Play Answer Audio
                    </button>
                    {speakingDoubt && (
                      <button
                        onClick={stopDoubtSpeech}
                        className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border"
                        style={{ borderColor: '#FF6B6B', color: '#FF6B6B', background: 'rgba(255,107,107,0.08)' }}
                      >
                        <Pause size={12} />Stop Audio
                      </button>
                    )}
                    <button
                      onClick={() => {
                        stopDoubtSpeech()
                        voice.resume(getResumePrompt())
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold"
                      style={{ background: '#4FFFA0', color: '#080B14' }}
                    >
                      <Play size={12} />Resume Voice Lesson
                    </button>
                  </div>
                </div>
              </div>
            )}

            {voice.transcript.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#1E2A42' }}>
                  <Volume2 size={13} style={{ color: '#6B7A99' }} />
                  <span className="text-xs font-bold" style={{ color: '#6B7A99' }}>TRANSCRIPT</span>
                </div>
                <VoiceTranscript messages={voice.transcript} />
              </div>
            )}
          </div>
        )}

        {/* DOUBT PANEL */}
        {panel === 'doubt' && (
          <div className="max-w-xl mx-auto">
            <DoubtPanel
              topic={topic}
              skill={skill}
              lessonId={lesson.id}
              onAskStart={handleTextDoubtStart}
              onAskComplete={handleTextDoubtComplete}
              voicePaused={voice.state !== 'idle' && voice.isPaused}
            />
          </div>
        )}
      </div>
    </div>
  )
}