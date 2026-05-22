'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { VoiceState } from '@/hooks/useVoice'

interface AIOrbProps {
  state: VoiceState
  onStart: () => void
  onStop: () => void
  durationSeconds?: number
}

// Color palettes for the fluid blobs based on VoiceState
const ORB_THEMES = {
  idle: [
    '#ffffff', // blob 1
    '#e2e8f0', // blob 2
    '#cbd5e1', // blob 3
    '#f8fafc', // blob 4
  ],
  connecting: [
    '#3b82f6',
    '#8b5cf6',
    '#60a5fa',
    '#a78bfa',
  ],
  listening: [
    '#4FFFA0', // Cyan/Green
    '#22D3EE', // Light Blue
    '#00D4AA', // Mint
    '#38bdf8', // Sky
  ],
  speaking: [
    '#2563eb', // Deep Blue
    '#c084fc', // Purple
    '#4FFFA0', // Cyan
    '#818cf8', // Indigo
  ],
  paused: [
    '#fbbf24',
    '#f59e0b',
    '#fcd34d',
    '#fb923c',
  ],
  error: [
    '#ef4444',
    '#f87171',
    '#dc2626',
    '#fca5a5',
  ],
}

// Map the states to UI labels
const LABELS = {
  idle:       { title: 'Start AI Session',  subtitle: 'Click to begin voice lesson' },
  connecting: { title: 'Connecting…',       subtitle: 'Establishing neural link' },
  listening:  { title: 'Listening',         subtitle: 'Speak naturally — AI is ready' },
  speaking:   { title: 'AI Explaining',     subtitle: 'Processing your query…' },
  paused:     { title: 'Session Paused',    subtitle: 'Click orb to resume' },
  error:      { title: 'Connection Lost',   subtitle: 'Tap to retry' },
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function AIOrb({ state, onStart, onStop, durationSeconds = 0 }: AIOrbProps) {
  const colors = ORB_THEMES[state] || ORB_THEMES.idle
  const label = LABELS[state] || LABELS.idle
  const isActive = state !== 'idle' && state !== 'error'
  const isSpeaking = state === 'speaking'

  return (
    <div className="flex flex-col items-center gap-10 select-none">
      
      {/* ── Main Interactive Orb ── */}
      <motion.button
        onClick={isActive ? onStop : onStart}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center justify-center rounded-full cursor-pointer focus:outline-none overflow-hidden"
        style={{
          width: 200,
          height: 200,
          // Inner shadow for the glassy 3D edge
          boxShadow: `0 0 50px ${colors[0]}40, inset 0 0 30px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.3)`,
          background: 'var(--color-app-surface)',
          border: `2px solid ${isActive ? colors[0] : 'var(--color-app-border)'}`,
        }}
        // Base container scale pulsing when speaking
        animate={{
          scale: isSpeaking ? [1, 1.06, 0.97, 1.04, 1] : 1
        }}
        transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0, ease: 'easeInOut' }}
      >
        <Image 
          src="/cartoon-young-woman-teacher-white-isolated-background-back-school-ai-generation_894218-901.avif"
          alt="AI Teacher Avatar"
          fill
          className="object-cover transition-opacity duration-500"
          style={{ opacity: isActive ? 1 : 0.5 }}
        />

        {/* Specular Highlight Overlay (Glass Reflection) */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.5) 100%)',
             }}
        />

        {/* Outer Ring Pulse when Listening */}
        {state === 'listening' && (
          <motion.div
            className="absolute inset-[-4px] rounded-full border-2 pointer-events-none"
            style={{ borderColor: colors[0] }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </motion.button>

      {/* ── Status Text ── */}
      <div className="text-center space-y-1.5">
        <motion.p
          key={label.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-bold tracking-wide"
          style={{ color: colors[0] }}
        >
          {label.title}
        </motion.p>
        <motion.p
          key={label.subtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs font-medium"
          style={{ color: 'var(--color-app-text-secondary)' }}
        >
          {isActive && durationSeconds > 0 ? formatTime(durationSeconds) : label.subtitle}
        </motion.p>
      </div>

    </div>
  )
}
