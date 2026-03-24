'use client'

import { Mic, MicOff, Square, Loader2, Volume2 } from 'lucide-react'
import type { VoiceState } from '@/hooks/useVoice'

interface VoiceOrbProps {
  state:         VoiceState
  isMuted:       boolean
  onStart:       () => void
  onStop:        () => void
  onMuteToggle:  () => void
  durationSeconds?: number
}

const STATE_CONFIG: Record<VoiceState, { color: string; glow: string; label: string; pulse: boolean }> = {
  idle:       { color: '#4FFFA0', glow: 'rgba(79,255,160,0.3)',  label: 'Start Voice Lesson', pulse: false },
  connecting: { color: '#5B8EFF', glow: 'rgba(91,142,255,0.3)',  label: 'Connecting…',        pulse: true  },
  listening:  { color: '#4FFFA0', glow: 'rgba(79,255,160,0.4)',  label: 'Listening…',         pulse: true  },
  speaking:   { color: '#C77DFF', glow: 'rgba(199,125,255,0.4)', label: 'AI is speaking…',    pulse: true  },
  paused:     { color: '#FFD166', glow: 'rgba(255,209,102,0.35)',label: 'Session paused',     pulse: false },
  error:      { color: '#FF6B6B', glow: 'rgba(255,107,107,0.3)', label: 'Connection error',   pulse: false },
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceOrb({ state, isMuted, onStart, onStop, onMuteToggle, durationSeconds = 0 }: VoiceOrbProps) {
  const cfg      = STATE_CONFIG[state]
  const isActive = state !== 'idle' && state !== 'error'

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Orb */}
      <div className="relative">
        {cfg.pulse && (
          <>
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: cfg.color, animationDuration: '2s' }} />
            <div className="absolute -inset-2 rounded-full animate-ping opacity-10"
              style={{ background: cfg.color, animationDuration: '2.5s', animationDelay: '0.5s' }} />
          </>
        )}
        <button onClick={isActive ? onStop : onStart}
          className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none"
          style={{
            background: `radial-gradient(circle at 40% 40%, ${cfg.color}30, ${cfg.color}10)`,
            border:     `2px solid ${cfg.color}`,
            boxShadow:  `0 0 32px ${cfg.glow}, inset 0 0 16px ${cfg.color}10`,
          }}>
          {state === 'connecting' ? <Loader2 size={32} className="animate-spin" style={{ color: cfg.color }} />
          : state === 'speaking'  ? <Volume2  size={32} style={{ color: cfg.color }} />
          : isActive              ? <Square   size={28} style={{ color: cfg.color }} />
          :                         <Mic      size={32} style={{ color: cfg.color }} />}
        </button>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-display font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
        {isActive && durationSeconds > 0 && (
          <p className="text-xs mt-1" style={{ color: '#6B7A99' }}>{formatTime(durationSeconds)}</p>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="flex items-center gap-3">
          <button onClick={onMuteToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs transition-all border"
            style={{
              borderColor: isMuted ? '#FF6B6B' : '#1E2A42',
              background:  isMuted ? 'rgba(255,107,107,0.1)' : 'transparent',
              color:       isMuted ? '#FF6B6B' : '#6B7A99',
            }}>
            {isMuted ? <><MicOff size={12} />Unmute</> : <><Mic size={12} />Mute</>}
          </button>
          <button onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs border transition-all"
            style={{ borderColor: '#FF6B6B', color: '#FF6B6B', background: 'rgba(255,107,107,0.08)' }}>
            <Square size={11} /> End Session
          </button>
        </div>
      )}
    </div>
  )
}