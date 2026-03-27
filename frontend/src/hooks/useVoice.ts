'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'paused' | 'error'

export interface VoiceMessage {
  role: 'assistant' | 'user'
  text: string
  time: Date
}

export interface UseVoiceOptions {
  topic:          string
  skill:          string
  level?:         string
  lessonContext?: string
  onTranscript?:  (text: string, role: 'user' | 'assistant') => void
}

export function useVoice(options: UseVoiceOptions) {
  const [state, setState]           = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<VoiceMessage[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [isMuted, setIsMuted]       = useState(false)
  const [isPaused, setIsPaused]     = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(0)

  const wsRef         = useRef<WebSocket | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioCtx      = useRef<AudioContext | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const startTimeRef  = useRef<number>(0)
  const hasServerAudioRef = useRef(false)
  const isPausedRef = useRef(false)

  const pickPreferredFemaleVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const preferredNames = [
      'Microsoft Zira',
      'Microsoft Aria',
      'Microsoft Jenny',
      'Google US English',
      'Samantha',
      'Victoria',
      'Karen',
      'Susan',
    ]

    const byPreferredName = preferredNames
      .map(name => voices.find(v => v.name.includes(name)))
      .find(Boolean)
    if (byPreferredName) return byPreferredName

    const byFemaleHint = voices.find(v => /female|woman|girl/i.test(`${v.name} ${v.voiceURI}`))
    if (byFemaleHint) return byFemaleHint

    const byEnglishFallback = voices.find(v => v.lang?.toLowerCase().startsWith('en'))
    return byEnglishFallback ?? voices[0] ?? null
  }, [])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const speakAssistantText = useCallback((text: string) => {
    if (isMuted) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const utterance = new SpeechSynthesisUtterance(text)
    const preferredVoice = pickPreferredFemaleVoice()
    if (preferredVoice) utterance.voice = preferredVoice
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onstart = () => setState('speaking')
    utterance.onend = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !isPausedRef.current) {
        setState('listening')
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [isMuted, pickPreferredFemaleVoice])

  useEffect(() => { return () => { stop() } }, [])  // eslint-disable-line

  useEffect(() => {
    if (state === 'idle' || !startTimeRef.current) {
      setDurationSeconds(0)
      return
    }

    const timer = setInterval(() => {
      setDurationSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)))
    }, 1000)

    return () => clearInterval(timer)
  }, [state])

  const addMessage = useCallback((text: string, role: 'user' | 'assistant') => {
    setTranscript(prev => [...prev, { role, text, time: new Date() }])
    options.onTranscript?.(text, role)
  }, [options])

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setState('connecting')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/api/voice/ws?topic=${encodeURIComponent(options.topic)}&skill=${encodeURIComponent(options.skill)}&level=${encodeURIComponent(options.level ?? 'beginner')}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      audioCtx.current = new AudioContext()

      ws.onopen = () => {
        setIsPaused(false)
        setState('listening')
        startTimeRef.current = Date.now()
        hasServerAudioRef.current = false
        setDurationSeconds(0)
        if (options.lessonContext) {
          ws.send(JSON.stringify({ type: 'context', content: options.lessonContext }))
        }
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
        mediaRecorder.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN && !isMuted && !isPausedRef.current) {
            e.data.arrayBuffer().then(buf => {
              ws.send(JSON.stringify({ type: 'audio', data: Array.from(new Uint8Array(buf)) }))
            })
          }
        }
        recorder.start(100)
      }

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data)
        if (isPausedRef.current && (msg.type === 'audio' || msg.type === 'transcript_ai')) {
          return
        }
        switch (msg.type) {
          case 'transcript_user': addMessage(msg.text, 'user'); setState('listening'); break
          case 'transcript_ai': {
            addMessage(msg.text, 'assistant')
            if (!hasServerAudioRef.current) {
              speakAssistantText(msg.text)
            }
            break
          }
          case 'audio': {
            hasServerAudioRef.current = true
            setState('speaking')
            const bytes    = new Uint8Array(msg.data)
            const audioBuf = await audioCtx.current!.decodeAudioData(bytes.buffer.slice(0))
            const source   = audioCtx.current!.createBufferSource()
            source.buffer  = audioBuf
            source.connect(audioCtx.current!.destination)
            source.onended = () => setState('listening')
            source.start()
            break
          }
          case 'interrupted': setState('listening'); break
          case 'error': setError(msg.message); setState('error'); break
        }
      }

      ws.onerror = () => { setError('Voice connection failed. Check backend availability and microphone permissions.'); setState('error') }
      ws.onclose = () => { if (state !== 'idle') setState('idle') }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start voice'
      setError(msg.includes('Permission denied') || msg.includes('NotAllowedError')
        ? 'Microphone access denied. Please allow microphone in your browser settings.'
        : msg
      )
      setState('error')
    }
  }, [state, options, isMuted, addMessage, speakAssistantText])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    mediaRecorder.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    wsRef.current?.close()
    audioCtx.current?.close()
    mediaRecorder.current = null
    streamRef.current     = null
    wsRef.current         = null
    audioCtx.current      = null
    startTimeRef.current  = 0
    setIsPaused(false)
    setDurationSeconds(0)
    setState('idle')
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      streamRef.current?.getTracks().forEach(t => { t.enabled = m })
      if (!m && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      return !m
    })
  }, [])

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', content: text }))
      addMessage(text, 'user')
    }
  }, [addMessage])

  const pause = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || isPausedRef.current) return

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
    setIsPaused(true)
    setState('paused')
  }, [])

  const resume = useCallback((resumePrompt?: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return
    if (isPausedRef.current) {
      setIsPaused(false)
    }
    setState('listening')
    wsRef.current.send(JSON.stringify({
      type: 'text',
      content: resumePrompt ?? 'Please continue the lesson from where we paused.',
    }))
  }, [])

  return {
    state,
    transcript,
    error,
    isMuted,
    isPaused,
    durationSeconds,
    start,
    stop,
    toggleMute,
    sendText,
    pause,
    resume,
  }
}