'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLesson } from '@/hooks/useLesson'
import { useVoice } from '@/hooks/useVoice'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useStreamingAI } from '@/hooks/useStreamingAI'
import { LessonStepCard } from '@/components/lesson/LessonStepCard'
import { DoubtPanel } from '@/components/lesson/DoubtPanel'
import { VoiceOrb } from '@/components/voice/VoiceOrb'
import { VoiceTranscript } from '@/components/voice/VoiceTranscript'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { AgenticTerminal } from '@/components/ui/AgenticTerminal'
import { ThoughtProcess } from '@/components/ui/ThoughtProcess'
import { FocusTimer }    from '@/components/ui/FocusTimer'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Mic, MessageCircle, FileText, Timer,
  CheckCircle, Loader2, BookOpen, ChevronLeft, ChevronRight, Volume2, Pause, Play, Send, MicOff
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

type PanelMode = 'lesson' | 'voice' | 'doubt' | 'focus'

interface DoubtResult {
  answer:       string
  analogy:      string
  code_example: string | null
}

export function LessonViewer({
  roadmapId, topic, skill, level, phaseName, weekNumber, existingLessonId, userName
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const { track } = useAnalytics()

  const { lesson, loading, error, generating, generateLesson, fetchLesson, completeLesson, generateNotes } = useLesson()
  const voice = useVoice({ topic, skill, level,
    lessonContext: lesson?.steps.map(s => `${s.title}: ${s.content}`).join('\n') })

  // ── AI Thought Process Streaming ────────────────────────────
  // We stream a topic overview so the AI's reasoning is visible
  // the moment the lesson content loads.
  const streaming = useStreamingAI({
    prompt:    `Explain the key concepts and learning objectives for "${topic}" in ${skill}`,
    context:   'lesson',
    topic,
    skill,
    level,
    userId:    undefined, // populated after auth resolves
    roadmapId,
  })

  const [activeStep, setActiveStep]     = useState(0)
  const [panel, setPanel]               = useState<PanelMode>('lesson')
  const [notesLoading, setNotesLoading] = useState(false)
  const [completing, setCompleting]     = useState(false)
  const [startTime]                     = useState(Date.now())
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

  const [speakingDoubt, setSpeakingDoubt] = useState(false)

  useEffect(() => {
    if (existingLessonId) fetchLesson(existingLessonId)
    else generateLesson({ roadmap_id: roadmapId, topic, skill, level, phase_name: phaseName, week_number: weekNumber })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-start the thought stream once the lesson content has loaded
  useEffect(() => {
    if (lesson && !streaming.isDone && !streaming.isThinking && !streaming.isStreaming) {
      streaming.start()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
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
    void track('lesson_completed', {
      event_data: {
        lesson_id: lesson.id,
        topic,
        skill,
        minutes_spent: mins,
      },
      page: '/lesson/current',
    })
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
      <div className="min-h-screen page-tone-mint">
        <DashboardNavbar userName={userName} />
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-5 w-full">
          {generating ? (
            <AgenticTerminal agentName="Lesson Teacher" />
          ) : (
            <div className="text-center animate-fade-up">
              <Loader2 size={36} className="animate-spin mx-auto mb-4" style={{ color: '#4FFFA0' }} />
              <h2 className="font-display font-black text-2xl mb-2" style={{ letterSpacing: '-0.5px' }}>
                Loading lesson…
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-app-text-secondary)' }}>
                Fetching saved lesson
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────
  if (error || !lesson) {
    return (
      <div className="min-h-screen page-tone-mint">
        <DashboardNavbar userName={userName} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <div className="text-5xl mb-2">😔</div>
          <h2 className="font-display font-black text-2xl">Lesson generation failed</h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--color-app-text-secondary)' }}>{error ?? 'Something went wrong.'}</p>
          <button
            onClick={() => generateLesson({ roadmap_id: roadmapId, topic, skill, level, phase_name: phaseName, week_number: weekNumber })}
            className="flex items-center gap-2 px-6 py-3 rounded-sm font-display font-bold text-sm"
            style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}>
            Try Again
          </button>
          <Link href="/dashboard" className="text-sm underline" style={{ color: 'var(--color-app-text-secondary)' }}>Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen page-tone-mint">
      <DashboardNavbar userName={userName} />

      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Breadcrumb + Actions */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--color-app-text-primary)]"
              style={{ color: 'var(--color-app-text-secondary)' }}><ArrowLeft size={12} /> Dashboard</Link>
            <span style={{ color: 'var(--color-app-border)' }}>/</span>
            <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>{phaseName}</span>
            <span style={{ color: 'var(--color-app-border)' }}>/</span>
            <span className="text-xs truncate">{topic}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleGenerateNotes} disabled={notesLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs border transition-all disabled:opacity-50"
              style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
              {notesLoading ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              {lesson.pdf_notes_url ? 'Download Notes' : 'Generate Notes'}
            </button>
            {!lesson.completed ? (
              <button onClick={handleComplete} disabled={completing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold disabled:opacity-50"
                style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}>
                {completing ? <><Loader2 size={11} className="animate-spin" />Completing…</> : <><CheckCircle size={11} />Mark Complete</>}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold"
                style={{
                  background: 'color-mix(in oklab, var(--color-app-surface-mint) 70%, var(--color-app-surface) 30%)',
                  color: '#188038',
                  border: '1px solid color-mix(in oklab, #188038 40%, var(--color-app-border))',
                }}>
                <CheckCircle size={11} /> Completed
              </div>
            )}
          </div>
        </div>

        {/* Lesson Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-sm"
              style={{
                background: 'color-mix(in oklab, var(--color-app-surface-mint) 70%, var(--color-app-surface) 30%)',
                color: '#188038',
                border: '1px solid color-mix(in oklab, #188038 40%, var(--color-app-border))',
              }}>
              Week {weekNumber}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>{phaseName}</span>
          </div>
          <h1 className="font-display font-black text-3xl" style={{ letterSpacing: '-1px' }}>{topic}</h1>
          {lesson.key_takeaway && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-app-text-secondary)' }}>{lesson.key_takeaway}</p>
          )}
          <div className="flex items-center gap-1 mt-4">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setActiveStep(i)}
                className="flex-1 h-1 rounded-full transition-all"
                style={{ background: i <= activeStep ? 'var(--color-app-primary)' : 'var(--color-app-border)', maxWidth: 60 }} />
            ))}
            <span className="text-xs ml-2" style={{ color: 'var(--color-app-text-secondary)' }}>{activeStep + 1}/{totalSteps}</span>
          </div>
        </div>

        {/* AI Thought Process Panel */}
        <ThoughtProcess
          thoughts={streaming.thoughts}
          content={streaming.content}
          isThinking={streaming.isThinking}
          isStreaming={streaming.isStreaming}
          isDone={streaming.isDone}
          error={streaming.error}
          onStart={streaming.start}
          onAbort={streaming.abort}
          showTrigger={!streaming.isThinking && !streaming.isStreaming && !streaming.isDone && !streaming.thoughts}
          triggerLabel={`Show AI reasoning for "${topic}"`}
          className="mb-6"
        />

        {/* Learning Actions */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Link href={quizHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
            Start Quiz
          </Link>
          <Link href={playgroundHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
            Start Challenge
          </Link>
          <Link href={reportHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
            Weekly Report
          </Link>
          <Link href={reviewHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
            Review Queue
          </Link>
          <Link href={leaderboardHref}
            className="text-center px-3 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
            Leaderboard
          </Link>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-0 mb-6 border rounded-sm overflow-hidden"
          style={{ borderColor: 'var(--color-app-border)', width: 'fit-content' }}>
          {[
            { mode: 'lesson' as PanelMode, icon: BookOpen,      label: 'Read'      },
            { mode: 'voice'  as PanelMode, icon: Mic,           label: 'Voice'     },
            { mode: 'doubt'  as PanelMode, icon: MessageCircle, label: 'Ask Doubt' },
            { mode: 'focus'  as PanelMode, icon: Timer,         label: 'Focus'     },
          ].map(({ mode, icon: Icon, label }) => (
            <button key={mode} onClick={() => handlePanelChange(mode)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs transition-all"
              style={{
                background: panel === mode ? 'color-mix(in oklab, var(--color-app-primary) 10%, var(--color-app-surface))' : 'var(--color-app-surface)',
                color:      panel === mode ? 'var(--color-app-primary)' : 'var(--color-app-text-secondary)',
                borderRight: '1px solid var(--color-app-border)',
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
                style={{ borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>Step {activeStep + 1} of {totalSteps}</span>
              {isLast ? (
                <button onClick={handleComplete} disabled={completing || lesson.completed}
                  className="flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-bold disabled:opacity-50"
                  style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}>
                  {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Complete Lesson
                </button>
              ) : (
                <button onClick={() => setActiveStep(Math.min(totalSteps - 1, activeStep + 1))}
                  className="flex items-center gap-2 px-5 py-3 rounded-sm text-sm font-bold"
                  style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}>
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
            {lesson.sources_used.length > 0 && (
              <div className="mt-6 p-4 rounded-sm" style={{ background: 'var(--color-app-surface)', border: '1px solid var(--color-app-border)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-app-text-secondary)' }}>SOURCES USED</p>
                <div className="flex flex-wrap gap-2">
                  {lesson.sources_used.map((src, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-sm"
                      style={{ background: 'color-mix(in oklab, var(--color-app-surface) 88%, var(--color-app-primary) 12%)', color: 'var(--color-app-text-secondary)', border: '1px solid var(--color-app-border)' }}>
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
              style={{ borderColor: voice.state !== 'idle' ? 'rgba(79,255,160,0.2)' : 'var(--color-app-border)' }}>
              <p className="text-sm mb-8" style={{ color: 'var(--color-app-text-secondary)' }}>
                {voice.state === 'idle'
                  ? `Start a voice session — AI will teach "${topic}" out loud. Interrupt anytime.`
                  : 'Voice session active. Speak naturally — interrupt anytime.'}
              </p>
              <VoiceOrb state={voice.state} isMuted={voice.isMuted}
                onStart={voice.start} onStop={voice.stop}
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
                      borderColor: voice.isPaused
                        ? 'color-mix(in oklab, #188038 42%, var(--color-app-border))'
                        : 'color-mix(in oklab, #b06000 38%, var(--color-app-border))',
                      color: voice.isPaused ? '#188038' : '#b06000',
                      background: voice.isPaused
                        ? 'color-mix(in oklab, var(--color-app-surface-mint) 72%, var(--color-app-surface) 28%)'
                        : 'color-mix(in oklab, var(--color-app-surface-warm) 72%, var(--color-app-surface) 28%)',
                    }}
                  >
                    {voice.isPaused ? <><Play size={12} />Resume Lesson</> : <><Pause size={12} />Pause Lesson</>}
                  </button>

                  <button
                    onClick={voice.toggleMute}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border transition-all"
                    style={{
                      borderColor: voice.isMuted
                        ? 'color-mix(in oklab, #188038 42%, var(--color-app-border))'
                        : 'color-mix(in oklab, #5B8EFF 38%, var(--color-app-border))',
                      color: voice.isMuted ? '#188038' : '#5B8EFF',
                      background: voice.isMuted
                        ? 'color-mix(in oklab, var(--color-app-surface-mint) 72%, var(--color-app-surface) 28%)'
                        : 'color-mix(in oklab, var(--color-app-surface-cool) 72%, var(--color-app-surface) 28%)',
                    }}
                  >
                    {voice.isMuted ? <><MicOff size={12} />Unmute</> : <><Mic size={12} />Mute</>}
                  </button>
                </div>
              )}

              <div className="mt-5 text-left">
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-app-text-secondary)' }}>
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
                    style={{ background: 'var(--color-app-surface)', borderColor: 'var(--color-app-border)', color: 'var(--color-app-text-primary)' }}
                  />
                  <button
                    onClick={sendTypedVoiceInput}
                    disabled={!voiceTextInput.trim()}
                    className="px-4 py-2.5 rounded-sm flex items-center gap-2 text-sm font-bold disabled:opacity-40 transition-opacity"
                    style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}
                  >
                    <Send size={14} />
                    Send
                  </button>
                </div>
                <p className="mt-2 text-[11px]" style={{ color: 'var(--color-app-text-secondary)' }}>
                  Works while voice is active and also resumes session automatically if it was paused.
                </p>
              </div>

              {voice.error && <p className="mt-4 text-xs" style={{ color: '#FF6B6B' }}>{voice.error}</p>}
            </div>

            {voiceDoubtResult && (
              <div className="glass-card p-5 mb-4 space-y-4">
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-app-text-secondary)' }}>YOUR VOICE DOUBT</p>
                  <p className="text-sm" style={{ color: 'var(--color-app-text-primary)' }}>{voiceDoubtQuestion}</p>
                </div>
                <div
                  className="p-4 rounded-sm"
                  style={{
                    background: 'color-mix(in oklab, var(--color-app-surface-cool) 68%, var(--color-app-surface) 32%)',
                    border: '1px solid color-mix(in oklab, var(--color-app-primary) 24%, var(--color-app-border))',
                  }}
                >
                  <p className="text-xs font-bold mb-2" style={{ color: '#188038' }}>EXPLANATION</p>
                  <MarkdownRenderer content={voiceDoubtResult.answer} />
                </div>
                <div
                  className="p-4 rounded-sm"
                  style={{
                    background: 'color-mix(in oklab, var(--color-app-surface-warm) 68%, var(--color-app-surface) 32%)',
                    border: '1px solid color-mix(in oklab, #f9ab00 40%, var(--color-app-border))',
                  }}
                >
                  <p className="text-xs font-bold mb-2" style={{ color: 'color-mix(in oklab, var(--color-app-text-primary) 74%, #b06000)' }}>ANALOGY</p>
                  <MarkdownRenderer content={voiceDoubtResult.analogy} />
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
                      style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}
                    >
                      <Play size={12} />Resume Voice Lesson
                    </button>
                  </div>
                </div>
              </div>
            )}

            {voice.transcript.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-app-border)' }}>
                  <Volume2 size={13} style={{ color: 'var(--color-app-text-secondary)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--color-app-text-secondary)' }}>TRANSCRIPT</span>
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

        {/* FOCUS PANEL — Pomodoro timer */}
        {panel === 'focus' && (
          <div className="max-w-sm mx-auto">
            {/* Header */}
            <div className="mb-4 text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--color-app-primary)' }}>
                Focus Mode
              </p>
              <h2 className="font-display font-black text-2xl" style={{ letterSpacing: '-0.5px' }}>
                Pomodoro Timer
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-app-text-secondary)' }}>
                Earn +50 XP per focus session · Long break every 4 sessions
              </p>
            </div>
            <FocusTimer
              onSessionComplete={(sessionNumber, xpEarned) => {
                toast.success(`🎯 Session #${sessionNumber} complete! +${xpEarned} XP earned`)
                track('focus_session_complete', { topic, skill, sessionNumber, xpEarned })
              }}
            />
          </div>
        )}

      </div>
    </div>
  )
}

