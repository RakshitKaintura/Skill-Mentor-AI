'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { VoiceState } from '@/hooks/useVoice'

interface Props { state: VoiceState }

const CONFIG: Record<VoiceState, { label: string; color: string; glow: string; dot: string }> = {
  idle:       { label: 'Idle',        color: 'var(--color-app-text-secondary)', glow: 'transparent',            dot: '#64748B' },
  connecting: { label: 'Connecting',  color: '#93C5FD',               glow: 'rgba(147,197,253,0.15)', dot: '#3B82F6' },
  listening:  { label: 'Listening',   color: '#4FFFA0',               glow: 'rgba(79,255,160,0.15)',  dot: '#4FFFA0' },
  speaking:   { label: 'Explaining',  color: '#A78BFA',               glow: 'rgba(167,139,250,0.15)', dot: '#A78BFA' },
  paused:     { label: 'Paused',      color: '#FCD34D',               glow: 'rgba(252,211,77,0.15)',  dot: '#FCD34D' },
  error:      { label: 'Disconnected',color: '#F87171',               glow: 'rgba(248,113,113,0.15)', dot: '#F87171' },
}

export function AIStatusBadge({ state }: Props) {
  const cfg = CONFIG[state]
  const isPulsing = state === 'listening' || state === 'speaking' || state === 'connecting'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.2 }}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          background: cfg.glow,
          border: `1px solid ${cfg.color}30`,
        }}
      >
        {/* Dot */}
        <div className="relative flex items-center justify-center w-2 h-2">
          {isPulsing && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: cfg.dot }}
              animate={{ scale: [1, 2.5, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <div className="w-2 h-2 rounded-full relative z-10" style={{ background: cfg.dot }} />
        </div>
        <span className="text-xs font-semibold tracking-wide" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
