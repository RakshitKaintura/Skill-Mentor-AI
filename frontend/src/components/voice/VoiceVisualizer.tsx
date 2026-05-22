'use client'

import { motion } from 'framer-motion'
import type { VoiceState } from '@/hooks/useVoice'

interface Props { state: VoiceState; barCount?: number }

const STATE_COLOR: Record<VoiceState, string> = {
  idle:       '79,255,160',
  connecting: '91,142,255',
  listening:  '79,255,160',
  speaking:   '167,139,250',
  paused:     '252,211,77',
  error:      '248,113,113',
}

export function VoiceVisualizer({ state, barCount = 20 }: Props) {
  const color = STATE_COLOR[state]
  const isActive = state === 'listening' || state === 'speaking'
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'

  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 40 }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2
        const distFromCenter = Math.abs(i - center) / center
        const baseHeight = isActive ? 6 : 3

        // Wave-like height profile
        const maxHeight = isSpeaking
          ? 36 - distFromCenter * 18
          : isListening
          ? 28 - distFromCenter * 12
          : 4

        const duration = isSpeaking
          ? 0.25 + Math.random() * 0.3
          : isListening
          ? 0.5 + Math.random() * 0.4
          : 1.5

        const delay = (i / barCount) * 0.4

        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{
              width: 2,
              background: isActive
                ? `rgba(${color}, ${0.9 - distFromCenter * 0.4})`
                : `rgba(${color}, 0.2)`,
              minHeight: 2,
            }}
            animate={isActive ? {
              height: [baseHeight, maxHeight, baseHeight * 1.3, maxHeight * 0.6, baseHeight],
            } : {
              height: [3, 5, 3],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }}
          />
        )
      })}
    </div>
  )
}
