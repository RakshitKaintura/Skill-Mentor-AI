'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, Mic, MicOff, Send,
  BookOpen, Lightbulb, MessageCircle, Bookmark,
  ChevronDown, ChevronUp, Volume2, Zap,
} from 'lucide-react'
import { AIOrb } from '@/components/voice/AIOrb'
import { VoiceVisualizer } from '@/components/voice/VoiceVisualizer'
import { AIStatusBadge } from '@/components/voice/AIStatusBadge'
import { TranscriptTimeline } from '@/components/voice/TranscriptTimeline'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { UseVoiceReturn } from '@/hooks/useVoice'

interface DoubtResult { answer: string; analogy: string; code_example: string | null }

interface Props {
  topic: string
  skill: string
  voice: UseVoiceReturn
  voiceTextInput: string
  setVoiceTextInput: (v: string) => void
  sendTypedVoiceInput: () => void
  voiceDoubtResult: DoubtResult | null
  voiceDoubtQuestion: string
  speakDoubtAnswer: (r: DoubtResult) => void
  speakingDoubt: boolean
  stopDoubtSpeech: () => void
  getResumePrompt: () => string
  xpPoints?: number
  socraticMode: boolean
  setSocraticMode: (val: boolean) => void
}

/** Quick-access concept cards shown in the right panel */
const SMART_CARDS = [
  { icon: BookOpen,    label: 'Key Concepts' },
  { icon: Lightbulb,  label: 'Insights' },
  { icon: MessageCircle, label: 'Follow-up' },
  { icon: Zap,        label: 'Quick Facts' },
]

export function VoiceLessonPanel({
  topic, skill, voice,
  voiceTextInput, setVoiceTextInput, sendTypedVoiceInput,
  voiceDoubtResult, voiceDoubtQuestion,
  speakDoubtAnswer, speakingDoubt, stopDoubtSpeech,
  getResumePrompt, xpPoints = 0,
  socraticMode, setSocraticMode,
}: Props) {
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const [savedConcepts] = useState<string[]>([])
  const isActive = voice.state !== 'idle' && voice.state !== 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full"
    >
      {/* ── Ambient mesh background ─────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--color-app-surface) 0%, var(--color-app-surface-cool) 50%, var(--color-app-surface) 100%)',
          border: '1px solid var(--color-app-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.1), 0 0 0 1px var(--color-app-border)',
        }}
      >
        {/* Gradient orbs (ambient) */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(79,255,160,0.04) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(91,142,255,0.04) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* ── SESSION HEADER ────────────────────────────────────── */}
        <div
          className="relative z-10 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ opacity: isActive ? [0.5, 1, 0.5] : 0.3 }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full"
                style={{ background: isActive ? '#4FFFA0' : '#334155' }}
              />
              <span className="text-xs font-bold uppercase tracking-widest"
                style={{ color: isActive ? 'rgba(79,255,160,0.8)' : 'rgba(100,116,139,0.7)' }}>
                AI Voice Session
              </span>
            </div>
            <AIStatusBadge state={voice.state} />
          </div>

          <div className="flex items-center gap-4">
            {/* Voice Selector */}
            {voice.availableVoices.length > 0 && (
              <select
                value={voice.selectedVoiceURI || ''}
                onChange={(e) => voice.setSelectedVoiceURI(e.target.value)}
                className="text-[10px] font-bold uppercase tracking-widest bg-transparent border border-white/10 rounded px-2 py-1 focus:outline-none"
                style={{ color: 'var(--color-app-text-secondary)', background: 'var(--color-app-surface)' }}
              >
                <option value="">Default Voice</option>
                {voice.availableVoices.filter(v => v.lang.startsWith('en')).map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                ))}
              </select>
            )}

            {/* Socratic Mode Toggle */}
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-app-text-secondary)' }}>
                Socratic Mode
              </span>
              <button
                onClick={() => setSocraticMode(!socraticMode)}
                className={`relative w-8 h-4 rounded-full transition-colors ${socraticMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${socraticMode ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* XP badge */}
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)' }}
              >
                <Zap size={10} style={{ color: '#FCD34D' }} />
                <span className="text-[10px] font-bold" style={{ color: '#FCD34D' }}>{xpPoints} XP</span>
              </motion.div>
            )}
            {/* Timer */}
            {isActive && voice.durationSeconds > 0 && (
              <span className="text-xs font-mono" style={{ color: 'var(--color-app-text-secondary)' }}>
                {Math.floor(voice.durationSeconds / 60)}:{String(voice.durationSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        {/* ── TOPIC STRIP ──────────────────────────────────────── */}
        <div className="relative z-10 px-6 py-3"
          style={{ borderBottom: '1px solid var(--color-app-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>{skill}</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-app-text-primary)' }}>{topic}</p>
        </div>

        {/* ── MAIN BODY ─────────────────────────────────────────── */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">

          {/* CENTER — Orb + Controls */}
          <div className="flex flex-col items-center justify-center px-8 py-12 gap-8">

            {/* Intro text */}
            {!isActive && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm max-w-sm"
                style={{ color: 'var(--color-app-text-secondary)' }}
              >
                Your AI tutor will teach <span style={{ color: 'var(--color-app-text-primary)', fontWeight: 600 }}>"{topic}"</span> out loud using adaptive pedagogy. Interrupt anytime.
              </motion.p>
            )}

            {/* AI Orb */}
            <AIOrb
              state={voice.state}
              onStart={voice.start}
              onStop={voice.stop}
              durationSeconds={voice.durationSeconds}
            />

            {/* Audio visualizer */}
            <VoiceVisualizer state={voice.state} barCount={24} />

            {/* Session controls */}
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 flex-wrap justify-center"
              >
                {/* Pause / Resume */}
                <button
                  onClick={() => {
                    if (voice.isPaused) {
                      stopDoubtSpeech()
                      voice.resume(getResumePrompt())
                    } else {
                      voice.pause()
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: voice.isPaused ? 'rgba(79,255,160,0.1)' : 'rgba(252,211,77,0.08)',
                    border: `1px solid ${voice.isPaused ? 'rgba(79,255,160,0.25)' : 'rgba(252,211,77,0.2)'}`,
                    color: voice.isPaused ? '#4FFFA0' : '#FCD34D',
                  }}
                >
                  {voice.isPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
                </button>

                {/* Mute */}
                <button
                  onClick={voice.toggleMute}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: voice.isMuted ? 'rgba(248,113,113,0.1)' : 'rgba(91,142,255,0.08)',
                    border: `1px solid ${voice.isMuted ? 'rgba(248,113,113,0.25)' : 'rgba(91,142,255,0.2)'}`,
                    color: voice.isMuted ? '#F87171' : '#93C5FD',
                  }}
                >
                  {voice.isMuted ? <><MicOff size={11} /> Unmute</> : <><Mic size={11} /> Mute</>}
                </button>

                {/* Stop */}
                <button
                  onClick={voice.stop}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(248,113,113,0.06)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    color: '#F87171',
                  }}
                >
                  End Session
                </button>
              </motion.div>
            )}

            {/* Text fallback input */}
            <div className="w-full max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-center"
                style={{ color: 'var(--color-app-text-secondary)' }}>
                Text Fallback
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voiceTextInput}
                  onChange={(e) => setVoiceTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendTypedVoiceInput()}
                  placeholder="Type a question or response…"
                  className="flex-1 px-4 py-2.5 text-sm rounded-full focus:outline-none"
                  style={{
                    background: 'var(--color-app-surface)',
                    border: '1px solid var(--color-app-border)',
                    color: 'var(--color-app-text-primary)',
                  }}
                />
                <button
                  onClick={sendTypedVoiceInput}
                  disabled={!voiceTextInput.trim()}
                  className="px-4 py-2.5 rounded-full flex items-center gap-2 text-xs font-bold disabled:opacity-30 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(79,255,160,0.2), rgba(34,211,238,0.15))',
                    border: '1px solid rgba(79,255,160,0.3)',
                    color: '#4FFFA0',
                  }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>

            {voice.error && (
              <p className="text-xs px-4 py-2 rounded-full"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
                {voice.error}
              </p>
            )}
          </div>

          {/* RIGHT — Smart Panel */}
          <div
            className="flex flex-col gap-0"
            style={{ borderLeft: '1px solid var(--color-app-border)' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-app-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-app-text-secondary)' }}>
                Smart Panel
              </p>
            </div>

            {/* Quick cards */}
            <div className="grid grid-cols-2 gap-2 p-4" style={{ borderBottom: '1px solid var(--color-app-border)' }}>
              {SMART_CARDS.map(({ icon: Icon, label }) => (
                <motion.button
                  key={label}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
                  style={{
                    background: 'var(--color-app-surface-cool)',
                    border: '1px solid var(--color-app-border)',
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--color-app-text-secondary)' }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--color-app-text-secondary)' }}>{label}</span>
                </motion.button>
              ))}
            </div>

            {/* Saved concepts */}
            {savedConcepts.length > 0 && (
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-app-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--color-app-text-secondary)' }}>Saved</p>
                <div className="flex flex-col gap-1.5">
                  {savedConcepts.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
                      style={{ background: 'rgba(79,255,160,0.05)', border: '1px solid rgba(79,255,160,0.1)', color: 'var(--color-app-text-primary)' }}>
                      <Bookmark size={9} className="flex-shrink-0 mt-0.5" style={{ color: '#4FFFA0' }} />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hint text or Visual Sync */}
            {voice.activeVisual ? (
              <div className="p-4" style={{ borderBottom: '1px solid var(--color-app-border)' }}>
                <div className="rounded-xl overflow-hidden text-sm"
                  style={{ background: 'var(--color-app-surface)', border: '1px solid var(--color-app-border)' }}>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-black/10 border-b border-black/5" style={{ color: 'var(--color-app-text-secondary)' }}>
                    AI Whiteboard
                  </div>
                  <div className="p-3">
                    <MarkdownRenderer content={voice.activeVisual} />
                  </div>
                </div>
              </div>
            ) : (
              !isActive && (
                <div className="flex-1 flex items-center justify-center px-4 py-8">
                  <p className="text-center text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
                    Start a session to see AI-generated notes and insights
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── DOUBT RESULT ─────────────────────────────────────── */}
        <AnimatePresence>
          {voiceDoubtResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative z-10"
              style={{ borderTop: '1px solid var(--color-app-border)' }}
            >
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.8)' }}>
                    ✦ Doubt Resolved
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => speakDoubtAnswer(voiceDoubtResult)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                      style={{ background: 'rgba(91,142,255,0.1)', border: '1px solid rgba(91,142,255,0.2)', color: '#93C5FD' }}
                    >
                      <Volume2 size={10} /> Play Audio
                    </button>
                    {speakingDoubt && (
                      <button
                        onClick={stopDoubtSpeech}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}
                      >
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => { stopDoubtSpeech(); voice.resume(getResumePrompt()) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: 'linear-gradient(135deg, rgba(79,255,160,0.15), rgba(34,211,238,0.1))',
                        border: '1px solid rgba(79,255,160,0.25)',
                        color: '#4FFFA0',
                      }}
                    >
                      <Play size={10} /> Resume Lesson
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-4"
                    style={{ background: 'rgba(79,255,160,0.04)', border: '1px solid rgba(79,255,160,0.12)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(79,255,160,0.6)' }}>Explanation</p>
                    <MarkdownRenderer content={voiceDoubtResult.answer} />
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: 'rgba(252,211,77,0.04)', border: '1px solid rgba(252,211,77,0.12)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(252,211,77,0.6)' }}>Analogy</p>
                    <MarkdownRenderer content={voiceDoubtResult.analogy} />
                  </div>
                </div>

                {voiceDoubtQuestion && (
                  <p className="text-xs italic" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    "{voiceDoubtQuestion}"
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TRANSCRIPT ───────────────────────────────────────── */}
        <div className="relative z-10" style={{ borderTop: '1px solid var(--color-app-border)' }}>
          <button
            onClick={() => setTranscriptOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 transition-colors hover:bg-black/[0.03]"
          >
            <div className="flex items-center gap-2">
              <Volume2 size={13} style={{ color: 'var(--color-app-text-secondary)' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-app-text-secondary)' }}>
                Transcript
              </span>
              {voice.transcript.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(91,142,255,0.1)', color: '#93C5FD' }}>
                  {voice.transcript.length}
                </span>
              )}
            </div>
            {transcriptOpen ? <ChevronUp size={13} style={{ color: 'var(--color-app-text-secondary)' }} />
              : <ChevronDown size={13} style={{ color: 'var(--color-app-text-secondary)' }} />}
          </button>

          <AnimatePresence>
            {transcriptOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden', borderTop: '1px solid var(--color-app-border)' }}
              >
                <TranscriptTimeline messages={voice.transcript} activeSpeech={voice.activeSpeech} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  )
}
