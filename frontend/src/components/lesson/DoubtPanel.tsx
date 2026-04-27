'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, X, MessageCircle } from 'lucide-react'
import { CodeBlock } from '@/components/lesson/CodeBlock'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

interface DoubtPanelProps {
  topic: string
  skill: string
  lessonId?: string
  onClose?: () => void
  onAskStart?: (question: string) => void
  onAskComplete?: (question: string, result: DoubtResult) => void
  voicePaused?: boolean
}

interface DoubtResult {
  answer: string
  analogy: string
  code_example: string | null
}

export function DoubtPanel({ topic, skill, lessonId, onClose, onAskStart, onAskComplete, voicePaused = false }: DoubtPanelProps) {
  const supabase = createClient()
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<DoubtResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ q: string; r: DoubtResult }>>([])

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    const q = question.trim()
    setQuestion('')
    onAskStart?.(q)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lesson/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, lesson_id: lessonId, topic, skill, question: q }),
      })

      if (!res.ok) throw new Error('Failed to get answer')
      const data: DoubtResult = await res.json()
      setResult(data)
      setHistory(h => [...h, { q, r: data }])
      onAskComplete?.(q, data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'var(--color-app-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-app-border)' }}>
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: '#C77DFF' }} />
          <span className="font-display text-sm font-bold">Ask a Doubt</span>
          <span className="rounded-sm px-2 py-0.5 text-xs" style={{ background: 'rgba(199,125,255,0.1)', color: '#C77DFF' }}>
            24/7 AI
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ color: 'var(--color-app-text-secondary)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="p-5">
        {voicePaused && (
          <div
            className="mb-3 inline-flex items-center gap-2 rounded-sm px-3 py-1 text-xs"
            style={{
              background: 'color-mix(in oklab, var(--color-app-surface-warm) 78%, var(--color-app-surface) 22%)',
              color: 'color-mix(in oklab, var(--color-app-text-primary) 78%, #b06000)',
              border: '1px solid color-mix(in oklab, #f9ab00 45%, var(--color-app-border))',
            }}
          >
            Voice lesson paused
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleAsk()}
            placeholder={`Ask anything about ${topic}...`}
            className="flex-1 rounded-sm px-4 py-3 text-sm"
            style={{
              background: 'var(--color-app-surface)',
              borderColor: 'var(--color-app-border)',
              color: 'var(--color-app-text-primary)',
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="flex items-center gap-2 rounded-sm px-4 py-3 text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--color-app-primary)', color: '#ffffff' }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        {error && <p className="mt-3 text-xs" style={{ color: '#FF6B6B' }}>{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4 px-5 pb-5">
          <div
            className="rounded-sm p-4"
            style={{
              background: 'color-mix(in oklab, var(--color-app-surface-cool) 68%, var(--color-app-surface) 32%)',
              border: '1px solid color-mix(in oklab, var(--color-app-primary) 24%, var(--color-app-border))',
            }}
          >
            <p className="mb-2 text-xs font-bold" style={{ color: '#188038' }}>EXPLANATION</p>
            <MarkdownRenderer content={result.answer} />
          </div>
          <div
            className="rounded-sm p-4"
            style={{
              background: 'color-mix(in oklab, var(--color-app-surface-warm) 68%, var(--color-app-surface) 32%)',
              border: '1px solid color-mix(in oklab, #f9ab00 40%, var(--color-app-border))',
            }}
          >
            <p className="mb-2 text-xs font-bold" style={{ color: 'color-mix(in oklab, var(--color-app-text-primary) 74%, #b06000)' }}>ANALOGY</p>
            <MarkdownRenderer content={result.analogy} />
          </div>
          {result.code_example && (
            <div>
              <p className="mb-2 text-xs font-bold" style={{ color: '#5B8EFF' }}>CODE EXAMPLE</p>
              <CodeBlock code={result.code_example} language={skill.toLowerCase()} />
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="border-t px-5 pb-5" style={{ borderColor: 'var(--color-app-border)' }}>
          <p className="mb-3 mt-4 text-xs font-bold" style={{ color: 'var(--color-app-text-secondary)' }}>PREVIOUS QUESTIONS</p>
          <div className="flex flex-col gap-2">
            {history.slice(0, -1).map((item, i) => (
              <button
                key={i}
                onClick={() => setResult(item.r)}
                className="rounded-sm px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--color-app-text-secondary)', border: '1px solid var(--color-app-border)' }}
              >
                {item.q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
