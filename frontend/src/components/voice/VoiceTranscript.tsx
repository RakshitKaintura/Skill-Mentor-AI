'use client'

import { useEffect, useRef } from 'react'
import type { VoiceMessage } from '@/hooks/useVoice'

interface Props { messages: VoiceMessage[] }

export function VoiceTranscript({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-4 opacity-30">🎙️</div>
        <p className="text-sm font-display font-bold mb-1" style={{ color: '#6B7A99' }}>Voice lesson transcript</p>
        <p className="text-xs" style={{ color: '#3A4A6A' }}>Your conversation will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto" style={{ maxHeight: '380px' }}>
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5"
            style={{
              background: msg.role === 'assistant' ? 'rgba(79,255,160,0.15)'  : 'rgba(91,142,255,0.15)',
              border:     `1px solid ${msg.role === 'assistant' ? 'rgba(79,255,160,0.3)' : 'rgba(91,142,255,0.3)'}`,
              color:      msg.role === 'assistant' ? '#4FFFA0' : '#5B8EFF',
            }}>
            {msg.role === 'assistant' ? '🤖' : '👤'}
          </div>
          <div className="max-w-[80%]">
            <div className="text-xs mb-1 px-1" style={{ color: '#6B7A99' }}>
              {msg.role === 'assistant' ? 'SkillMentor AI' : 'You'}
              {' '}· {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="px-4 py-3 rounded-sm text-sm leading-relaxed"
              style={{
                background: msg.role === 'assistant' ? '#0E1420' : 'rgba(91,142,255,0.1)',
                border:     `1px solid ${msg.role === 'assistant' ? '#1E2A42' : 'rgba(91,142,255,0.2)'}`,
                color: '#E8EDF8',
              }}>
              {msg.text}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}