'use client'

// ── FocusTimer ────────────────────────────────────────────────
// Pomodoro-style focus timer with circular SVG ring, XP rewards,
// configurable durations, and browser push notifications.

import { useState } from 'react'
import {
  Play, Pause, SkipForward, RotateCcw,
  Settings, X, Zap, Coffee, Brain, Minimize2, Maximize2
} from 'lucide-react'
import { usePomodoro, type TimerPhase } from '@/hooks/usePomodoro'

// ── Config ───────────────────────────────────────────────────

interface Props {
  /** Called on each completed focus session so the parent can award XP */
  onSessionComplete?: (session: number, xpEarned: number) => void
  className?: string
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

const PHASE_META: Record<TimerPhase, { label: string; color: string; gradient: { from: string, to: string }; Icon: typeof Brain; bg: string }> = {
  idle:        { label: 'Ready to focus',    color: '#FF5A5F', gradient: { from: '#FF5A5F', to: '#FF8A4C' }, Icon: Brain,       bg: 'color-mix(in oklab, #FF5A5F 8%, var(--color-app-surface) 92%)'   },
  focus:       { label: 'Focus Session',     color: '#FF5A5F', gradient: { from: '#FF5A5F', to: '#FF8A4C' }, Icon: Brain,       bg: 'color-mix(in oklab, #FF5A5F 8%, var(--color-app-surface) 92%)'   },
  short_break: { label: 'Short Break ☕',    color: '#4FFFA0', gradient: { from: '#4FFFA0', to: '#00D1FF' }, Icon: Coffee,      bg: 'color-mix(in oklab, #4FFFA0 8%, var(--color-app-surface) 92%)'   },
  long_break:  { label: 'Long Break 🌿',     color: '#C77DFF', gradient: { from: '#C77DFF', to: '#FF6B6B' }, Icon: Coffee,      bg: 'color-mix(in oklab, #C77DFF 8%, var(--color-app-surface) 92%)' },
}

// ── Circular SVG ring ─────────────────────────────────────────

function TimerRing({
  secondsLeft, totalSeconds, color, gradient, phase,
}: { secondsLeft: number; totalSeconds: number; color: string; gradient: { from: string, to: string }; phase: TimerPhase }) {
  const R    = 52
  const CIRC = 2 * Math.PI * R
  const pct  = phase === 'idle' ? 1 : secondsLeft / Math.max(1, totalSeconds)
  const dash = pct * CIRC
  const gap  = CIRC - dash
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="absolute inset-0">
        {/* Glow filter */}
        <defs>
          <filter id="timer-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`timer-grad-${phase}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient.from} />
            <stop offset="100%" stopColor={gradient.to} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="70" cy="70" r={R} fill="none"
          stroke="var(--color-app-border)" strokeWidth="8" />
        {/* Progress arc */}
        <circle cx="70" cy="70" r={R} fill="none"
          stroke={`url(#timer-grad-${phase})`} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
          transform="rotate(-90 70 70)"
          filter="url(#timer-glow)"
          style={{ transition: 'stroke-dasharray 0.5s linear' }}
        />
      </svg>
      {/* Center display */}
      <div className="flex flex-col items-center z-10">
        <span className="font-display font-black text-3xl tabular-nums" style={{ color, letterSpacing: '-1px' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        {phase !== 'idle' && (
          <span className="text-[10px] font-semibold uppercase tracking-widest mt-0.5"
            style={{ color: 'var(--color-app-text-secondary)' }}>
            {phase === 'focus' ? 'remaining' : 'break'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────

function SettingsPanel({
  focusMins, breakMins, longBreakMins,
  onSave, onClose,
}: {
  focusMins: number; breakMins: number; longBreakMins: number;
  onSave: (focus: number, brk: number, longBrk: number) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(focusMins)
  const [b, setB] = useState(breakMins)
  const [lb, setLb] = useState(longBreakMins)

  const Slider = ({ label, value, min, max, onChange, color }: {
    label: string; value: number; min: number; max: number;
    onChange: (v: number) => void; color: string;
  }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--color-app-text-secondary)' }}>{label}</span>
        <span className="font-bold" style={{ color }}>{value} min</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  )

  return (
    <div className="p-4 space-y-4"
      style={{ border: '1px solid var(--color-app-border)', borderRadius: 16, background: 'var(--color-app-surface)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-app-primary)' }}>
          Timer Settings
        </span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
      <Slider label="Focus duration" value={f} min={5} max={60} onChange={setF} color="var(--color-app-primary)" />
      <Slider label="Short break"    value={b} min={1} max={15} onChange={setB} color="#4FFFA0" />
      <Slider label="Long break"     value={lb} min={5} max={30} onChange={setLb} color="#C77DFF" />
      <button onClick={() => { onSave(f, b, lb); onClose() }}
        className="w-full py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90"
        style={{ background: 'var(--color-app-primary)', color: '#fff' }}>
        Save Settings
      </button>
    </div>
  )
}

// ── Session dots ──────────────────────────────────────────────

function SessionDots({ count, longBreakEvery = 4 }: { count: number; longBreakEvery?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: longBreakEvery }).map((_, i) => (
        <div key={i}
          className="w-2 h-2 rounded-full transition-all"
          style={{
            background: i < (count % longBreakEvery)
              ? 'var(--color-app-primary)'
              : 'var(--color-app-border)',
            transform: i < (count % longBreakEvery) ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export function FocusTimer({ onSessionComplete, className = '', isMinimized, onToggleMinimize }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [focusMins,    setFocusMins]    = useState(25)
  const [breakMins,    setBreakMins]    = useState(5)
  const [longBreakMins, setLongBreak]   = useState(15)

  const pomodoro = usePomodoro(onSessionComplete)
  const meta     = PHASE_META[pomodoro.phase]

  const handleSaveSettings = (f: number, b: number, lb: number) => {
    setFocusMins(f); setBreakMins(b); setLongBreak(lb)
    pomodoro.configure({ focusMins: f, shortBreakMins: b, longBreakMins: lb })
    if (pomodoro.phase === 'idle') pomodoro.reset()
  }

  const mins = Math.floor(pomodoro.secondsLeft / 60)
  const secs = pomodoro.secondsLeft % 60

  if (isMinimized) {
    return (
      <div 
        className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-grab active:cursor-grabbing shadow-lg transition-all duration-300 ${className}`}
        style={{
          border: `1px solid ${
            pomodoro.phase === 'focus'
              ? 'color-mix(in oklab, var(--color-app-primary) 40%, var(--color-app-border))'
              : pomodoro.phase === 'short_break'
              ? 'color-mix(in oklab, #4FFFA0 40%, var(--color-app-border))'
              : pomodoro.phase === 'long_break'
              ? 'color-mix(in oklab, #C77DFF 40%, var(--color-app-border))'
              : 'var(--color-app-border)'
          }`,
          background: 'var(--color-app-surface)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <meta.Icon size={14} style={{ color: meta.color }} />
        <span className="font-display font-black text-sm tabular-nums" style={{ color: meta.color, letterSpacing: '-0.5px' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        
        <div className="flex items-center gap-1 border-l pl-3 ml-1" style={{ borderColor: 'var(--color-app-border)' }}>
          {pomodoro.phase === 'idle' ? (
            <button onClick={pomodoro.start} className="p-1.5 rounded-full hover:bg-[var(--color-app-bg)] transition-colors">
              <Play size={12} fill="currentColor" style={{ color: 'var(--color-app-text-primary)' }} />
            </button>
          ) : (
            <button onClick={pomodoro.isRunning ? pomodoro.pause : pomodoro.resume} className="p-1.5 rounded-full hover:bg-[var(--color-app-bg)] transition-colors">
              {pomodoro.isRunning ? <Pause size={12} fill="currentColor" style={{ color: 'var(--color-app-text-primary)' }} /> : <Play size={12} fill="currentColor" style={{ color: 'var(--color-app-text-primary)' }} />}
            </button>
          )}
          {onToggleMinimize && (
            <button onClick={onToggleMinimize} className="p-1.5 rounded-full hover:bg-[var(--color-app-bg)] transition-colors text-[var(--color-app-text-secondary)]">
              <Maximize2 size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-300 ${className}`}
      style={{
        border: `1px solid ${
          pomodoro.phase === 'focus'
            ? 'color-mix(in oklab, var(--color-app-primary) 28%, var(--color-app-border))'
            : pomodoro.phase === 'short_break'
            ? 'color-mix(in oklab, #4FFFA0 28%, var(--color-app-border))'
            : pomodoro.phase === 'long_break'
            ? 'color-mix(in oklab, #C77DFF 28%, var(--color-app-border))'
            : 'var(--color-app-border)'
        }`,
        background: meta.bg,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <meta.Icon size={14} style={{ color: meta.color }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* XP badge */}
          {pomodoro.xpEarned > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(255,209,102,0.15)', color: '#b06000', border: '1px solid rgba(255,209,102,0.3)' }}>
              <Zap size={9} />+{pomodoro.xpEarned} XP
            </div>
          )}
          <button onClick={() => setShowSettings(s => !s)}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--color-app-text-secondary)' }}>
            <Settings size={13} />
          </button>
          {onToggleMinimize && (
            <button onClick={onToggleMinimize}
              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
              style={{ color: 'var(--color-app-text-secondary)' }}>
              <Minimize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 pb-2">
          <SettingsPanel
            focusMins={focusMins} breakMins={breakMins} longBreakMins={longBreakMins}
            onSave={handleSaveSettings} onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Ring + controls */}
      <div className="flex flex-col items-center gap-4 px-4 pb-4">
        <TimerRing
          secondsLeft={pomodoro.secondsLeft}
          totalSeconds={pomodoro.totalSeconds}
          color={meta.color}
          gradient={meta.gradient}
          phase={pomodoro.phase}
        />

        {/* Session dots */}
        <SessionDots count={pomodoro.sessionsToday} />

        {/* Session count */}
        <p className="text-[11px]" style={{ color: 'var(--color-app-text-secondary)' }}>
          {pomodoro.sessionsToday === 0
            ? `${focusMins} min focus · ${breakMins} min break`
            : `${pomodoro.sessionsToday} session${pomodoro.sessionsToday > 1 ? 's' : ''} completed today`}
        </p>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {pomodoro.phase === 'idle' ? (
            <button onClick={pomodoro.start}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${meta.gradient.from}, ${meta.gradient.to})`, color: '#fff', boxShadow: `0 4px 14px ${meta.color}50` }}>
              <Play size={14} fill="white" />
              Start Focus
            </button>
          ) : (
            <>
              {/* Pause / Resume */}
              <button
                onClick={pomodoro.isRunning ? pomodoro.pause : pomodoro.resume}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${meta.gradient.from}, ${meta.gradient.to})`, color: '#fff', boxShadow: `0 4px 14px ${meta.color}40` }}
              >
                {pomodoro.isRunning ? <><Pause size={12} fill="white" />Pause</> : <><Play size={12} fill="white" />Resume</>}
              </button>

              {/* Skip */}
              <button onClick={pomodoro.skip}
                className="p-2 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}
                title="Skip to next phase">
                <SkipForward size={14} />
              </button>

              {/* Reset */}
              <button onClick={pomodoro.reset}
                className="p-2 rounded-xl transition-all hover:opacity-70 active:scale-95"
                style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}
                title="Reset timer">
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>

        {/* Phase hint */}
        {pomodoro.phase !== 'idle' && (
          <p className="text-[10px] text-center" style={{ color: 'var(--color-app-text-secondary)' }}>
            {pomodoro.phase === 'focus'
              ? '🧠 Stay in the zone — notifications paused'
              : pomodoro.phase === 'short_break'
              ? '☕ Rest your eyes, stretch your legs'
              : '🌿 Great work! Take a longer break — you earned it'}
          </p>
        )}
      </div>
    </div>
  )
}
