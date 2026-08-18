'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'paused' | 'error'

export interface VoiceMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  time: Date
}

export interface UseVoiceOptions {
  topic:          string
  skill:          string
  level?:         string
  lessonContext?: string
  socratic?:      boolean
  onTranscript?:  (text: string, role: 'user' | 'assistant') => void
}

export function useVoice(options: UseVoiceOptions) {
  const [state, setState]           = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState<VoiceMessage[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [isMuted, setIsMuted]       = useState(false)
  const [isPaused, setIsPaused]     = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [activeSpeech, setActiveSpeech]       = useState<{ id: string, charIndex: number } | null>(null)
  const [activeVisual, setActiveVisual]       = useState<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null)

  const wsRef         = useRef<WebSocket | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioCtx      = useRef<AudioContext | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const startTimeRef  = useRef<number>(0)
  const hasServerAudioRef = useRef(false)
  const isPausedRef = useRef(false)

  const normalizeVoiceError = useCallback((raw: string) => {
    const lower = raw.toLowerCase()
    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('resource_exhausted') ||
      lower.includes('high demand') ||
      lower.includes('rate limit')
    ) {
      return 'Voice AI is temporarily busy. Please try again in a few seconds.'
    }
    return raw
  }, [])

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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices())
      updateVoices()
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const speakAssistantText = useCallback((text: string, messageId: string) => {
    if (isMuted) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    // Strip markdown formatting symbols so the TTS doesn't read "asterisk asterisk"
    const cleanText = text.replace(/[*_#`~>]/g, '').trim()
    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    let voiceToUse = null
    if (selectedVoiceURI) {
      voiceToUse = availableVoices.find(v => v.voiceURI === selectedVoiceURI)
    }
    if (!voiceToUse) {
      voiceToUse = pickPreferredFemaleVoice()
    }
    
    if (voiceToUse) utterance.voice = voiceToUse
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onstart = () => {
      setState('speaking')
      setActiveSpeech({ id: messageId, charIndex: 0 })
    }
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        setActiveSpeech({ id: messageId, charIndex: e.charIndex })
      }
    }
    utterance.onend = () => {
      setActiveSpeech(null)
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
    const id = Math.random().toString(36).substring(7)
    setTranscript(prev => [...prev, { id, role, text, time: new Date() }])
    options.onTranscript?.(text, role)
    return id
  }, [options])

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setState('connecting')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const tokenQuery = session?.access_token ? `&token=${session.access_token}` : ''

      const socraticQuery = options.socratic ? `&socratic=true` : ''
      const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/api/voice/ws?topic=${encodeURIComponent(options.topic)}&skill=${encodeURIComponent(options.skill)}&level=${encodeURIComponent(options.level ?? 'beginner')}${tokenQuery}${socraticQuery}`
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
            const msgId = addMessage(msg.text, 'assistant')
            if (!hasServerAudioRef.current) {
              speakAssistantText(msg.text, msgId)
            }
            break
          }
          case 'transcript_visual': setActiveVisual(msg.content); break
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
          case 'error': setError(normalizeVoiceError(msg.message ?? 'Voice session failed.')); setState('error'); break
        }
      }

      ws.onerror = () => { setError('Voice connection failed. Check backend availability and microphone permissions.'); setState('error') }
      ws.onclose = () => { if (state !== 'idle') setState('idle') }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start voice'
      setError(msg.includes('Permission denied') || msg.includes('NotAllowedError')
        ? 'Microphone access denied. Please allow microphone in your browser settings.'
        : normalizeVoiceError(msg)
      )
      setState('error')
    }
  }, [state, options, isMuted, addMessage, speakAssistantText, normalizeVoiceError])

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
    setActiveSpeech(null)
    setActiveVisual(null)
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
      // The backend echoes this as 'transcript_user', so we don't add it locally to prevent duplicates
    }
  }, [])

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
    activeSpeech,
    activeVisual,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    start,
    stop,
    pause,
    resume,
    toggleMute,
    sendText,
  }
}

export type UseVoiceReturn = ReturnType<typeof useVoice>