'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────

export type TimerPhase = 'focus' | 'short_break' | 'long_break' | 'idle'

export interface PomodoroSession {
  sessionNumber:    number   // how many focus rounds completed
  focusMins:        number   // configurable (default 25)
  shortBreakMins:   number   // configurable (default 5)
  longBreakMins:    number   // configurable (default 15)
  longBreakEvery:   number   // after N sessions (default 4)
}

export interface UsePomodoroReturn {
  phase:          TimerPhase
  secondsLeft:    number
  totalSeconds:   number
  sessionsToday:  number
  isRunning:      boolean
  isPaused:       boolean
  xpEarned:       number     // XP accumulated this study period
  start:          () => void
  pause:          () => void
  resume:         () => void
  skip:           () => void
  reset:          () => void
  configure:      (opts: Partial<PomodoroSession>) => void
}

const DEFAULT_CONFIG: PomodoroSession = {
  sessionNumber:  0,
  focusMins:      25,
  shortBreakMins: 5,
  longBreakMins:  15,
  longBreakEvery: 4,
}

const XP_PER_FOCUS_SESSION = 50

// ── Hook ─────────────────────────────────────────────────────

export function usePomodoro(
  onSessionComplete?: (session: number, xpEarned: number) => void,
): UsePomodoroReturn {
  const [config, setConfig]           = useState<PomodoroSession>(DEFAULT_CONFIG)
  const [phase, setPhase]             = useState<TimerPhase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [totalSeconds, setTotalSecs]  = useState(0)
  const [isRunning, setIsRunning]     = useState(false)
  const [isPaused, setIsPaused]       = useState(false)
  const [sessionsToday, setSessions]  = useState(0)
  const [xpEarned, setXpEarned]       = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef    = useRef<TimerPhase>('idle')
  const configRef   = useRef(config)

  // Keep refs in sync
  useEffect(() => { phaseRef.current  = phase    }, [phase])
  useEffect(() => { configRef.current = config   }, [config])

  const clearTick = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  // ── Phase transitions ────────────────────────────────────

  const advancePhase = useCallback((completedPhase: TimerPhase, completedSessions: number) => {
    const cfg = configRef.current

    if (completedPhase === 'focus') {
      const newSessions = completedSessions + 1
      setSessions(newSessions)
      const xp = newSessions * XP_PER_FOCUS_SESSION
      setXpEarned(xp)

      // Fire browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🎉 Focus session complete!', {
          body: `+${XP_PER_FOCUS_SESSION} XP earned! Time for a break.`,
          icon: '/favicon.ico',
        })
      }

      onSessionComplete?.(newSessions, xp)

      // Next phase: long break every N sessions, else short
      const isLongBreak = newSessions % cfg.longBreakEvery === 0
      const nextPhase   = isLongBreak ? 'long_break' : 'short_break'
      const nextSecs    = (isLongBreak ? cfg.longBreakMins : cfg.shortBreakMins) * 60
      setPhase(nextPhase)
      setSecondsLeft(nextSecs)
      setTotalSecs(nextSecs)
      return newSessions
    } else {
      // Break done → back to focus
      const nextSecs = cfg.focusMins * 60
      setPhase('focus')
      setSecondsLeft(nextSecs)
      setTotalSecs(nextSecs)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🎯 Break over!', { body: 'Time to focus. You\'ve got this!' })
      }
    }
    return completedSessions
  }, [onSessionComplete])

  // ── Tick ─────────────────────────────────────────────────

  const startTick = useCallback((initialSeconds: number, initialSessions: number) => {
    clearTick()
    let secs     = initialSeconds
    let sessions = initialSessions

    intervalRef.current = setInterval(() => {
      secs -= 1
      setSecondsLeft(secs)

      if (secs <= 0) {
        clearTick()
        sessions = advancePhase(phaseRef.current, sessions) as number
        // Auto-start next phase
        const cfg     = configRef.current
        const nextPhase = phaseRef.current  // already updated by advancePhase via setState
        // Delay a tick so state settles
        setTimeout(() => {
          const nextSecs = phaseRef.current === 'focus'
            ? cfg.focusMins * 60
            : phaseRef.current === 'short_break'
            ? cfg.shortBreakMins * 60
            : cfg.longBreakMins * 60
          startTick(nextSecs, sessions)
        }, 500)
      }
    }, 1000)
  }, [clearTick, advancePhase])

  // ── Public API ────────────────────────────────────────────

  const start = useCallback(() => {
    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const secs = config.focusMins * 60
    setPhase('focus')
    setSecondsLeft(secs)
    setTotalSecs(secs)
    setIsRunning(true)
    setIsPaused(false)
    startTick(secs, sessionsToday)
  }, [config.focusMins, sessionsToday, startTick])

  const pause = useCallback(() => {
    clearTick()
    setIsPaused(true)
    setIsRunning(false)
  }, [clearTick])

  const resume = useCallback(() => {
    setIsRunning(true)
    setIsPaused(false)
    startTick(secondsLeft, sessionsToday)
  }, [secondsLeft, sessionsToday, startTick])

  const skip = useCallback(() => {
    clearTick()
    const newSessions = advancePhase(phase, sessionsToday) as number
    // Restart tick with whatever phase was set
    setTimeout(() => {
      const cfg = configRef.current
      const secs = phaseRef.current === 'focus'
        ? cfg.focusMins * 60
        : phaseRef.current === 'short_break'
        ? cfg.shortBreakMins * 60
        : cfg.longBreakMins * 60
      startTick(secs, newSessions)
    }, 100)
  }, [clearTick, advancePhase, phase, sessionsToday, startTick])

  const reset = useCallback(() => {
    clearTick()
    setPhase('idle')
    setSecondsLeft(0)
    setTotalSecs(0)
    setIsRunning(false)
    setIsPaused(false)
    setSessions(0)
    setXpEarned(0)
  }, [clearTick])

  const configure = useCallback((opts: Partial<PomodoroSession>) => {
    setConfig(prev => ({ ...prev, ...opts }))
  }, [])

  // Cleanup on unmount
  useEffect(() => () => clearTick(), [clearTick])

  return {
    phase, secondsLeft, totalSeconds: totalSeconds || config.focusMins * 60,
    sessionsToday, isRunning, isPaused, xpEarned,
    start, pause, resume, skip, reset, configure,
  }
}
