'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────

export type StreamEventType = 'thought' | 'text' | 'done' | 'error'

export interface StreamChunk {
  type:  StreamEventType
  text?: string
}

export interface UseStreamingAIOptions {
  /** User-visible question / topic to stream about */
  prompt:     string
  /** Context hint for the backend system prompt */
  context?:   'lesson' | 'roadmap' | 'doubt'
  topic?:     string
  skill?:     string
  level?:     string
  userId?:    string
  roadmapId?: string
  /** Called once the full content is complete */
  onComplete?: (fullContent: string, fullThoughts: string) => void
}

export interface UseStreamingAIReturn {
  /** All raw thought chunks joined together */
  thoughts:    string
  /** All raw answer/content chunks joined together */
  content:     string
  /** True while the model is outputting thought chunks */
  isThinking:  boolean
  /** True while the model is outputting final answer chunks */
  isStreaming: boolean
  /** Non-null when an error occurred */
  error:       string | null
  /** True once the full stream is done */
  isDone:      boolean
  /** Start the SSE stream. Can be called multiple times to re-stream. */
  start:       () => void
  /** Abort any active stream */
  abort:       () => void
  /** Reset state back to initial */
  reset:       () => void
}

// ── Hook ─────────────────────────────────────────────────────

export function useStreamingAI(options: UseStreamingAIOptions): UseStreamingAIReturn {
  const [thoughts,    setThoughts]    = useState('')
  const [content,     setContent]     = useState('')
  const [isThinking,  setIsThinking]  = useState(false)
  const [isStreaming, setIsStreaming]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isDone,      setIsDone]      = useState(false)

  const abortRef       = useRef<AbortController | null>(null)
  const thoughtsRef    = useRef('')
  const contentRef     = useRef('')

  const reset = useCallback(() => {
    setThoughts('')
    setContent('')
    setIsThinking(false)
    setIsStreaming(false)
    setError(null)
    setIsDone(false)
    thoughtsRef.current = ''
    contentRef.current  = ''
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsThinking(false)
    setIsStreaming(false)
  }, [])

  const start = useCallback(() => {
    // Cancel any prior stream
    abortRef.current?.abort()

    reset()

    const controller  = new AbortController()
    abortRef.current  = controller

    // Build SSE URL
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const params = new URLSearchParams({
      prompt:  options.prompt,
      context: options.context ?? 'lesson',
      topic:   options.topic   ?? '',
      skill:   options.skill   ?? '',
      level:   options.level   ?? 'beginner',
    })
    if (options.userId)    params.set('user_id',    options.userId)
    if (options.roadmapId) params.set('roadmap_id', options.roadmapId)

    const url = `${base}/api/stream/think?${params.toString()}`

    ;(async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok || !response.body) {
          setError(`Stream failed: HTTP ${response.status}`)
          return
        }

        const reader  = response.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ''

        setIsThinking(true)

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE lines are separated by double newlines
          const events = buffer.split('\n\n')
          // The last element may be a partial event — keep it for next iteration
          buffer = events.pop() ?? ''

          for (const event of events) {
            // Each event looks like: "data: {...}"
            const line = event.trim()
            if (!line.startsWith('data:')) continue

            const jsonStr = line.slice('data:'.length).trim()
            let chunk: StreamChunk
            try {
              chunk = JSON.parse(jsonStr) as StreamChunk
            } catch {
              continue
            }

            if (chunk.type === 'thought' && chunk.text) {
              thoughtsRef.current += chunk.text
              setThoughts(thoughtsRef.current)
              setIsThinking(true)
              setIsStreaming(false)
            } else if (chunk.type === 'text' && chunk.text) {
              contentRef.current += chunk.text
              setContent(contentRef.current)
              // Transition: stop showing "thinking", start showing streaming content
              setIsThinking(false)
              setIsStreaming(true)
            } else if (chunk.type === 'done') {
              setIsThinking(false)
              setIsStreaming(false)
              setIsDone(true)
              options.onComplete?.(contentRef.current, thoughtsRef.current)
              return
            } else if (chunk.type === 'error') {
              setIsThinking(false)
              setIsStreaming(false)
              setError(chunk.text ?? 'Unknown streaming error')
              return
            }
          }
        }

        // Stream ended naturally (e.g. connection closed)
        setIsThinking(false)
        setIsStreaming(false)
        setIsDone(true)

      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setIsThinking(false)
        setIsStreaming(false)
        setError(err instanceof Error ? err.message : 'Streaming failed')
      }
    })()
  }, [options, reset])

  // Clean up on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return {
    thoughts,
    content,
    isThinking,
    isStreaming,
    error,
    isDone,
    start,
    abort,
    reset,
  }
}
