'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, X, Sparkles, BookOpen, Lightbulb, Code2 } from 'lucide-react'
import { CodeBlock } from '@/components/lesson/CodeBlock'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { motion, AnimatePresence } from 'framer-motion'

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl w-full max-w-4xl mx-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(10,10,10,0.95) 0%, rgba(24,24,24,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: 'rgba(199,125,255,0.1)' }}>
            <Sparkles size={16} style={{ color: '#C77DFF' }} />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Ask AI Mentor
            </h3>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Instant Doubt Resolution
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/5"
            style={{ color: 'rgba(148,163,184,0.7)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-6">
        {/* ── INPUT AREA ── */}
        <div className="relative z-10 mb-6">
          {voicePaused && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: 'rgba(252,211,77,0.1)',
                color: '#FCD34D',
                border: '1px solid rgba(252,211,77,0.2)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Voice lesson paused while you ask
            </motion.div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleAsk()}
                placeholder={`Ask anything about ${topic}...`}
                className="w-full rounded-xl px-5 py-3.5 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.9)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                }}
              />
            </div>
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="group flex items-center justify-center w-14 rounded-xl transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #C77DFF 0%, #7B2CBF 100%)',
                boxShadow: '0 4px 14px rgba(123,44,191,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                color: '#ffffff',
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs" style={{ color: '#FF6B6B' }}>
              {error}
            </motion.p>
          )}
        </div>

        {/* ── AI RESULT ── */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Explanation Card */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: 'linear-gradient(to right, rgba(79,255,160,0.05), transparent)',
                  border: '1px solid rgba(79,255,160,0.15)',
                  borderLeft: '4px solid #4FFFA0',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={14} style={{ color: '#4FFFA0' }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4FFFA0' }}>
                    Explanation
                  </p>
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <MarkdownRenderer content={result.answer} />
                </div>
              </div>

              {/* Analogy Card */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: 'linear-gradient(to right, rgba(252,211,77,0.05), transparent)',
                  border: '1px solid rgba(252,211,77,0.15)',
                  borderLeft: '4px solid #FCD34D',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} style={{ color: '#FCD34D' }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FCD34D' }}>
                    Analogy
                  </p>
                </div>
                <div className="text-sm leading-relaxed italic" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <MarkdownRenderer content={result.analogy} />
                </div>
              </div>

              {/* Code Example Card */}
              {result.code_example && (
                <div
                  className="rounded-xl p-5"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: '4px solid #A8B2C1',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Code2 size={14} style={{ color: '#A8B2C1' }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A8B2C1' }}>
                      Code Example
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-white/5">
                    <CodeBlock code={result.code_example} language={skill.toLowerCase()} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HISTORY ── */}
        {history.length > 1 && (
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Previous Questions
            </p>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, -1).map((item, i) => (
                <button
                  key={i}
                  onClick={() => setResult(item.r)}
                  className="rounded-full px-4 py-2 text-[11px] transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(226,232,240,0.8)',
                  }}
                >
                  {item.q.length > 40 ? item.q.substring(0, 40) + '...' : item.q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
