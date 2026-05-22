'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { VoiceMessage } from '@/hooks/useVoice'

interface Props {
  messages: VoiceMessage[]
  activeSpeech?: { id: string, charIndex: number } | null
}

function HighlightText({ text, charIndex }: { text: string, charIndex: number }) {
  let endOfWord = charIndex
  while (endOfWord < text.length && !/\s/.test(text[endOfWord])) {
    endOfWord++
  }

  const before = text.slice(0, charIndex)
  const current = text.slice(charIndex, endOfWord)
  const after = text.slice(endOfWord)

  return (
    <span>
      <span style={{ color: 'var(--color-app-text-primary)' }}>{before}</span>
      <span style={{ color: '#4FFFA0', textShadow: '0 0 8px rgba(79,255,160,0.4)', fontWeight: 600 }}>{current}</span>
      <span style={{ color: 'var(--color-app-text-secondary)' }}>{after}</span>
    </span>
  )
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TranscriptTimeline({ messages, activeSpeech }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.97, 1.03, 0.97] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-5xl mb-5"
        >🎙️</motion.div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-app-text-secondary)' }}>
          Conversation will appear here
        </p>
        <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
          Start a voice session to begin
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-2 py-4 overflow-y-auto" style={{ maxHeight: 420 }}>
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const isAI = msg.role === 'assistant'
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1"
                style={{
                  background: isAI
                    ? 'radial-gradient(circle at 40% 35%, rgba(79,255,160,0.25), rgba(79,255,160,0.05))'
                    : 'radial-gradient(circle at 40% 35%, rgba(91,142,255,0.25), rgba(91,142,255,0.05))',
                  border: `1px solid ${isAI ? 'rgba(79,255,160,0.3)' : 'rgba(91,142,255,0.3)'}`,
                  boxShadow: isAI
                    ? '0 0 12px rgba(79,255,160,0.15)'
                    : '0 0 12px rgba(91,142,255,0.15)',
                }}
              >
                {isAI ? '✦' : '◎'}
              </div>

              {/* Message bubble */}
              <div className={`flex flex-col gap-1 max-w-[82%] ${isAI ? 'items-start' : 'items-end'}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold tracking-wide" style={{
                    color: isAI ? 'rgba(79,255,160,0.7)' : 'rgba(91,142,255,0.7)'
                  }}>
                    {isAI ? 'SkillMentor AI' : 'You'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>
                    {formatTime(msg.time)}
                  </span>
                  {isAI && (
                    <motion.div
                      className="flex items-center gap-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="rounded-full"
                          style={{
                            width: 2, height: j === 1 ? 8 : 5,
                            background: 'rgba(79,255,160,0.4)',
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>

                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: isAI
                      ? 'var(--color-app-surface-cool)'
                      : 'linear-gradient(135deg, rgba(91,142,255,0.12), rgba(91,142,255,0.06))',
                    border: `1px solid ${isAI ? 'rgba(79,255,160,0.18)' : 'rgba(91,142,255,0.2)'}`,
                    boxShadow: isAI
                      ? '0 4px 16px rgba(0,0,0,0.06)'
                      : '0 4px 16px rgba(91,142,255,0.08)',
                    color: 'var(--color-app-text-primary)',
                  }}
                >
                  {isAI ? (
                    activeSpeech?.id === msg.id ? (
                      <HighlightText text={msg.text} charIndex={activeSpeech.charIndex} />
                    ) : (
                      <MarkdownRenderer content={msg.text} />
                    )
                  ) : msg.text}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  )
}
