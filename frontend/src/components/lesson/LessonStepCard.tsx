'use client'

import { CodeBlock } from './CodeBlock'
import type { LessonStep } from '@/hooks/useLesson'

interface Props {
  step:     LessonStep
  index:    number
  isActive: boolean
  onClick:  () => void
}

const STEP_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  intro:     { icon: '📖', color: '#4FFFA0', bg: 'rgba(79,255,160,0.08)'  },
  analogy:   { icon: '💡', color: '#FFD166', bg: 'rgba(255,209,102,0.08)' },
  code_demo: { icon: '💻', color: '#5B8EFF', bg: 'rgba(91,142,255,0.08)'  },
  try_it:    { icon: '✏️', color: '#C77DFF', bg: 'rgba(199,125,255,0.08)' },
  mistakes:  { icon: '⚠️', color: '#FF8C42', bg: 'rgba(255,140,66,0.08)'  },
  summary:   { icon: '✅', color: '#4FFFA0', bg: 'rgba(79,255,160,0.08)'  },
}

export function LessonStepCard({ step, index, isActive, onClick }: Props) {
  const cfg = STEP_CONFIG[step.type] ?? { icon: '•', color: '#6B7A99', bg: 'rgba(107,122,153,0.08)' }

  return (
    <div onClick={onClick}
      className="rounded-sm cursor-pointer transition-all duration-200"
      style={{
        border:     `1px solid ${isActive ? cfg.color + '40' : '#1E2A42'}`,
        background: isActive ? cfg.bg : '#0E1420',
        transform:  isActive ? 'none' : 'scale(0.99)',
      }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{
            background: isActive ? cfg.color + '20' : '#141B2D',
            border:     `1px solid ${isActive ? cfg.color + '40' : '#1E2A42'}`,
          }}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm truncate">{step.title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-sm uppercase tracking-widest"
              style={{ background: cfg.color + '15', color: cfg.color, fontSize: '9px' }}>
              {step.type.replace('_', ' ')}
            </span>
          </div>
          {!isActive && (
            <p className="text-xs truncate mt-0.5" style={{ color: '#6B7A99' }}>
              {step.content.slice(0, 80)}…
            </p>
          )}
        </div>
        <div className="text-xs" style={{ color: '#3A4A6A' }}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      {/* Expanded content */}
      {isActive && (
        <div className="px-5 pb-6 border-t" style={{ borderColor: cfg.color + '20' }}>
          <div className="mt-4 space-y-4">
            <div className="text-sm leading-relaxed" style={{ color: '#C4CFEA' }}>
              {step.content.split('\n\n').map((para, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : ''}>{para}</p>
              ))}
            </div>
            {step.code_snippet && (
              <div className="mt-4">
                <CodeBlock
                  code={step.code_snippet}
                  language={step.language ?? 'javascript'}
                  title={step.type === 'try_it' ? '✏️ Your starter template' : step.type === 'code_demo' ? '💻 Live example' : undefined}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}