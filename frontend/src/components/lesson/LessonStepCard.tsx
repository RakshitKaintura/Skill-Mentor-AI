'use client'

import { CodeBlock } from './CodeBlock'
import type { LessonStep } from '@/hooks/useLesson'

interface Props {
  step: LessonStep
  index: number
  isActive: boolean
  onClick: () => void
}

const STEP_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  intro: {
    icon: 'I',
    color: '#188038',
    bg: 'color-mix(in oklab, var(--color-app-surface-mint) 72%, var(--color-app-surface) 28%)',
  },
  analogy: {
    icon: 'A',
    color: '#b06000',
    bg: 'color-mix(in oklab, var(--color-app-surface-warm) 72%, var(--color-app-surface) 28%)',
  },
  code_demo: {
    icon: 'C',
    color: '#1a73e8',
    bg: 'color-mix(in oklab, var(--color-app-surface-cool) 72%, var(--color-app-surface) 28%)',
  },
  try_it: {
    icon: 'T',
    color: '#7e57c2',
    bg: 'color-mix(in oklab, var(--color-app-surface-lavender) 72%, var(--color-app-surface) 28%)',
  },
  mistakes: {
    icon: 'M',
    color: '#c26401',
    bg: 'color-mix(in oklab, var(--color-app-surface-warm) 65%, var(--color-app-surface) 35%)',
  },
  summary: {
    icon: 'S',
    color: '#188038',
    bg: 'color-mix(in oklab, var(--color-app-surface-mint) 72%, var(--color-app-surface) 28%)',
  },
}

export function LessonStepCard({ step, index, isActive, onClick }: Props) {
  const cfg =
    STEP_CONFIG[step.type] ?? {
      icon: '*',
      color: 'var(--color-app-text-secondary)',
      bg: 'color-mix(in oklab, var(--color-app-surface) 86%, var(--color-app-surface-cool) 14%)',
    }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-sm transition-all duration-200"
      style={{
        border: `1px solid ${isActive ? cfg.color + '40' : 'var(--color-app-border)'}`,
        background: isActive ? cfg.bg : 'var(--color-app-surface)',
        transform: isActive ? 'none' : 'scale(0.99)',
      }}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: isActive ? cfg.color + '20' : 'color-mix(in oklab, var(--color-app-surface) 88%, var(--color-app-primary) 12%)',
            border: `1px solid ${isActive ? cfg.color + '40' : 'var(--color-app-border)'}`,
            color: cfg.color,
          }}
        >
          {cfg.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold font-display">{step.title}</span>
            <span
              className="rounded-sm px-1.5 py-0.5 text-xs uppercase tracking-widest"
              style={{ background: cfg.color + '15', color: cfg.color, fontSize: '9px' }}
            >
              {step.type.replace('_', ' ')}
            </span>
          </div>
          {!isActive && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
              {step.content.slice(0, 80)}...
            </p>
          )}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>

      {isActive && (
        <div className="border-t px-5 pb-6" style={{ borderColor: cfg.color + '20' }}>
          <div className="mt-4 space-y-4">
            <div className="text-sm leading-relaxed" style={{ color: 'var(--color-app-text-primary)' }}>
              {step.content.split('\n\n').map((para, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : ''}>
                  {para}
                </p>
              ))}
            </div>
            {step.code_snippet && (
              <div className="mt-4">
                <CodeBlock
                  code={step.code_snippet}
                  language={step.language ?? 'javascript'}
                  title={step.type === 'try_it' ? 'Starter template' : step.type === 'code_demo' ? 'Live example' : undefined}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
