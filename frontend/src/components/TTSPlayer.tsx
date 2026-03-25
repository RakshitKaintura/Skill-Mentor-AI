'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Segment {
  segment_id: number
  type: string
  text: string
  estimated_secs: number
}

interface TTSPlayerProps {
  segments: Segment[]
  topic?: string
  autoPlay?: boolean
  onSegmentChange?: (segmentId: number) => void
}

export default function TTSPlayer({
  segments,
  autoPlay = false,
  onSegmentChange,
}: TTSPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [rate, setRate] = useState(0.9)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const cancelledRef = useRef(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  const speak = useCallback((idx: number) => {
    function playFrom(startIdx: number) {
      if (!supported || startIdx >= segments.length) {
        setPlaying(false)
        return
      }

      cancelledRef.current = false
      window.speechSynthesis.cancel()

      const seg = segments[startIdx]
      const utter = new SpeechSynthesisUtterance(seg.text)
      utter.rate = rate
      utter.pitch = 1.0
      utter.volume = 1.0
      utter.lang = 'en-US'

      const voices = window.speechSynthesis.getVoices()
      const preferred = ['Google US English', 'Microsoft Zira', 'Alex', 'Samantha']
      const voice = preferred.reduce<SpeechSynthesisVoice | null>((found, name) => {
        if (found) return found
        return voices.find(v => v.name.includes(name)) || null
      }, null)
      if (voice) utter.voice = voice

      utter.onend = () => {
        if (cancelledRef.current) return
        const next = startIdx + 1
        setCurrentIdx(next)
        onSegmentChange?.(next)
        if (next < segments.length) {
          playFrom(next)
        } else {
          setPlaying(false)
        }
      }

      utter.onerror = () => setPlaying(false)

      utteranceRef.current = utter
      window.speechSynthesis.speak(utter)
      setCurrentIdx(startIdx)
      onSegmentChange?.(startIdx)
    }

    playFrom(idx)
  }, [segments, rate, supported, onSegmentChange])

  const handlePlay = () => {
    setPlaying(true)
    speak(currentIdx)
  }

  const handlePause = () => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    setPlaying(false)
  }

  const handleRestart = () => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    setCurrentIdx(0)
    setPlaying(true)
    setTimeout(() => speak(0), 50)
  }

  const handleSkip = (direction: 'prev' | 'next') => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    const next = direction === 'next'
      ? Math.min(currentIdx + 1, segments.length - 1)
      : Math.max(currentIdx - 1, 0)
    setCurrentIdx(next)
    if (playing) {
      setTimeout(() => {
        cancelledRef.current = false
        speak(next)
      }, 50)
    }
  }

  useEffect(() => {
    if (autoPlay && supported && segments.length > 0) {
      setTimeout(() => {
        setPlaying(true)
        speak(0)
      }, 800)
    }
  }, [autoPlay, supported, segments.length, speak])

  if (!supported) return null

  const progress = segments.length ? (currentIdx / segments.length) * 100 : 0
  const segTypeColor: Record<string, string> = {
    intro: 'bg-brand-green',
    concept: 'bg-brand-blue',
    example: 'bg-brand-yellow',
    code_note: 'bg-brand-purple',
    summary: 'bg-brand-red',
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
      <div className="mb-3">
        <div className="flex justify-between text-xs font-mono text-brand-muted mb-1">
          <span>🔊 Audio Lesson</span>
          <span>{currentIdx + 1} / {segments.length}</span>
        </div>
        <div className="h-1.5 bg-brand-border rounded-full overflow-hidden">
          <div
            className="h-1.5 bg-gradient-to-r from-brand-green to-brand-blue rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {segments[currentIdx] && (
        <div className="mb-4 px-3 py-2 bg-brand-bg/50 rounded border border-brand-border">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${segTypeColor[segments[currentIdx].type] || 'bg-brand-muted'} ${playing ? 'animate-pulse' : ''}`} />
            <span className="text-brand-muted font-mono text-xs uppercase">{segments[currentIdx].type}</span>
          </div>
          <p className="text-brand-text font-mono text-xs leading-relaxed line-clamp-3">
            {segments[currentIdx].text}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSkip('prev')}
            className="w-8 h-8 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-green/40 transition-colors flex items-center justify-center text-sm"
          >
            ⏮
          </button>
          <button
            onClick={playing ? handlePause : handlePlay}
            className="w-10 h-10 rounded-xl bg-brand-green text-brand-bg font-bold text-lg hover:bg-brand-green/90 transition-colors flex items-center justify-center"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => handleSkip('next')}
            className="w-8 h-8 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-green/40 transition-colors flex items-center justify-center text-sm"
          >
            ⏭
          </button>
          <button
            onClick={handleRestart}
            className="w-8 h-8 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-green/40 transition-colors flex items-center justify-center text-sm"
          >
            ↺
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-brand-muted font-mono text-xs">Speed</span>
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="bg-brand-bg border border-brand-border rounded px-2 py-1 text-brand-text font-mono text-xs"
          >
            <option value={0.7}>0.7×</option>
            <option value={0.9}>0.9×</option>
            <option value={1.0}>1×</option>
            <option value={1.2}>1.2×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </div>
      </div>
    </div>
  )
}