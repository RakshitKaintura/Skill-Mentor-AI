'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Brain, Sparkles, Zap } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

// ── Types ────────────────────────────────────────────────────

interface Props {
  /** Raw thought text accumulated from the stream */
  thoughts:    string
  /** Raw answer text accumulated from the stream */
  content:     string
  /** True while the model is still producing thoughts */
  isThinking:  boolean
  /** True while the model is producing the answer */
  isStreaming: boolean
  /** True once the full stream has completed */
  isDone:      boolean
  /** Optional error message */
  error?:      string | null
  /** Called when user clicks "Start Thinking" */
  onStart?:    () => void
  /** Called when user clicks Abort */
  onAbort?:    () => void
  /** If provided, show a trigger button to kick off the stream */
  showTrigger?:  boolean
  triggerLabel?: string
  className?:  string
}

// ── Animated dots ────────────────────────────────────────────

function PulsingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] ml-1 align-middle">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="block w-[5px] h-[5px] rounded-full"
          style={{
            background: 'var(--color-app-primary)',
            animation: `blink 1.4s ${i * 0.22}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  )
}

// ── Thought step pills ───────────────────────────────────────

const PHASE_ICONS = ['🤔', '🔍', '📚', '🧠', '✍️', '✅']
const PHASE_LABELS = [
  'Analysing request',
  'Querying knowledge',
  'Selecting pedagogy',
  'Structuring response',
  'Drafting content',
  'Finalising answer',
]

function ThinkingPhasePills({ thoughts, isThinking }: { thoughts: string; isThinking: boolean }) {
  // Derive an approximate "phase" from how many chars of thought we've received
  const phase = Math.min(
    PHASE_LABELS.length - 1,
    Math.floor((thoughts.length / 400))
  )

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {PHASE_LABELS.map((label, i) => {
        const isActive  = i === phase && isThinking
        const isPast    = i < phase || (!isThinking && thoughts.length > 0)

        return (
          <div
            key={label}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-500"
            style={{
              background: isActive
                ? 'color-mix(in oklab, var(--color-app-primary) 14%, var(--color-app-surface))'
                : isPast
                ? 'color-mix(in oklab, #188038 12%, var(--color-app-surface))'
                : 'var(--color-app-surface)',
              border: `1px solid ${
                isActive
                  ? 'color-mix(in oklab, var(--color-app-primary) 38%, var(--color-app-border))'
                  : isPast
                  ? 'color-mix(in oklab, #188038 28%, var(--color-app-border))'
                  : 'var(--color-app-border)'
              }`,
              color: isActive
                ? 'var(--color-app-primary)'
                : isPast
                ? '#188038'
                : 'var(--color-app-text-secondary)',
              transform: isActive ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <span>{PHASE_ICONS[i]}</span>
            {label}
            {isActive && <PulsingDots />}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export function ThoughtProcess({
  thoughts,
  content,
  isThinking,
  isStreaming,
  isDone,
  error,
  onStart,
  onAbort,
  showTrigger = false,
  triggerLabel = 'Show AI Thinking',
  className = '',
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showThoughts, setShowThoughts] = useState(false)
  const thoughtsEndRef = useRef<HTMLDivElement>(null)

  // Auto-open when streaming starts
  useEffect(() => {
    if (isThinking || isStreaming) setIsExpanded(true)
  }, [isThinking, isStreaming])

  // Auto-scroll thoughts
  useEffect(() => {
    if (isThinking) {
      thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [thoughts, isThinking])

  const isActive = isThinking || isStreaming
  const hasStarted = thoughts.length > 0 || content.length > 0

  // ── Idle state (trigger button) ──────────────────────────
  if (!hasStarted && !isActive && showTrigger && !error) {
    return (
      <div className={`rounded-xl border p-4 ${className}`}
        style={{ borderColor: 'var(--color-app-border)', background: 'var(--color-app-surface)' }}>
        <button
          onClick={onStart}
          className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'color-mix(in oklab, var(--color-app-primary) 10%, var(--color-app-surface))', color: 'var(--color-app-primary)', border: '1px dashed color-mix(in oklab, var(--color-app-primary) 38%, var(--color-app-border))' }}
        >
          <Brain size={15} />
          {triggerLabel}
          <Sparkles size={13} />
        </button>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────
  if (error) {
    return (
      <div className={`rounded-xl border p-4 ${className}`}
        style={{ borderColor: '#ff6b6b40', background: 'color-mix(in oklab, #ff6b6b 8%, var(--color-app-surface))' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: '#ff6b6b' }}>
          <Zap size={14} /> Stream error
        </div>
        <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>{error}</p>
        {onStart && (
          <button onClick={onStart} className="mt-3 text-xs underline" style={{ color: 'var(--color-app-primary)' }}>
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${className}`}
      style={{
        borderColor: isActive
          ? 'color-mix(in oklab, var(--color-app-primary) 30%, var(--color-app-border))'
          : isDone
          ? 'color-mix(in oklab, #188038 22%, var(--color-app-border))'
          : 'var(--color-app-border)',
        background: 'var(--color-app-surface)',
        boxShadow: isActive
          ? '0 0 0 3px color-mix(in oklab, var(--color-app-primary) 8%, transparent)'
          : 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={() => setIsExpanded(e => !e)}
        className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--color-app-surface)_94%,var(--color-app-primary)_6%)]"
      >
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              background: isThinking
                ? 'var(--color-app-primary)'
                : isStreaming
                ? '#f9ab00'
                : isDone
                ? '#188038'
                : 'var(--color-app-border)',
              animation: isActive ? 'blink 1.2s ease-in-out infinite' : 'none',
            }}
          />
          <Brain size={14} style={{ color: isActive ? 'var(--color-app-primary)' : 'var(--color-app-text-secondary)' }} />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{
              color: isActive
                ? 'var(--color-app-primary)'
                : isDone
                ? '#188038'
                : 'var(--color-app-text-secondary)',
            }}
          >
            {isThinking
              ? 'AI Thinking…'
              : isStreaming
              ? 'Generating Answer…'
              : isDone
              ? 'Thought Process Complete'
              : 'AI Thought Process'}
          </span>
          {isThinking && <PulsingDots />}
        </div>

        <div className="flex items-center gap-2">
          {isActive && onAbort && (
            <button
              onClick={e => { e.stopPropagation(); onAbort() }}
              className="text-xs px-2 py-0.5 rounded-md border transition-colors"
              style={{ borderColor: '#ff6b6b40', color: '#ff6b6b', background: 'rgba(255,107,107,0.08)' }}
            >
              Stop
            </button>
          )}
          {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-app-text-secondary)' }} />
                      : <ChevronDown size={14} style={{ color: 'var(--color-app-text-secondary)' }} />}
        </div>
      </div>

      {/* ── Collapsible body ── */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--color-app-border)' }}>

          {/* Phase pills */}
          {(isThinking || thoughts.length > 0) && (
            <div className="pt-4">
              <ThinkingPhasePills thoughts={thoughts} isThinking={isThinking} />
            </div>
          )}

          {/* Thoughts raw stream (collapsible) */}
          {thoughts.length > 0 && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                border: '1px solid color-mix(in oklab, var(--color-app-primary) 18%, var(--color-app-border))',
                background: 'color-mix(in oklab, var(--color-app-surface-cool) 55%, var(--color-app-surface) 45%)',
              }}
            >
              <button
                onClick={() => setShowThoughts(t => !t)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold"
                style={{ color: 'var(--color-app-primary)' }}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={11} />
                  Raw reasoning chain
                  <span className="font-mono font-normal opacity-60">({thoughts.length} chars)</span>
                </span>
                {showThoughts
                  ? <ChevronUp size={11} />
                  : <ChevronDown size={11} />}
              </button>

              {showThoughts && (
                <div
                  className="px-3 pb-3 max-h-48 overflow-y-auto text-xs leading-relaxed font-mono whitespace-pre-wrap"
                  style={{
                    color: 'var(--color-app-text-secondary)',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--color-app-border) transparent',
                  }}
                >
                  {thoughts}
                  {isThinking && <span className="animate-pulse">▌</span>}
                  <div ref={thoughtsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Streaming answer */}
          {(content.length > 0 || isStreaming) && (
            <div
              className="rounded-lg p-3"
              style={{
                border: '1px solid color-mix(in oklab, #f9ab00 22%, var(--color-app-border))',
                background: 'color-mix(in oklab, var(--color-app-surface-warm) 50%, var(--color-app-surface) 50%)',
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#b06000' }}
              >
                ✍️ Generating Response
              </p>
              <MarkdownRenderer content={isStreaming ? content + '▌' : content} />
            </div>
          )}

          {/* Done state summary */}
          {isDone && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{
                background: 'color-mix(in oklab, #188038 10%, var(--color-app-surface))',
                border: '1px solid color-mix(in oklab, #188038 22%, var(--color-app-border))',
                color: '#188038',
              }}
            >
              ✅ Thought process complete
              <span className="font-normal opacity-70">
                · {thoughts.length} reasoning chars · {content.length} answer chars
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
