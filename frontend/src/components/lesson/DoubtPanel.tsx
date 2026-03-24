'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, X, MessageCircle } from 'lucide-react'
import { CodeBlock } from '@/components/lesson/CodeBlock'

interface DoubtPanelProps {
  topic:      string
  skill:      string
  lessonId?:  string
  onClose?:   () => void
}

interface DoubtResult {
  answer:       string
  analogy:      string
  code_example: string | null
}

export function DoubtPanel({ topic, skill, lessonId, onClose }: DoubtPanelProps) {
  const supabase = createClient()
  const [question, setQuestion] = useState('')
  const [result, setResult]     = useState<DoubtResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [history, setHistory]   = useState<Array<{ q: string; r: DoubtResult }>>([])

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    const q = question.trim()
    setQuestion('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/lesson/doubt`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, lesson_id: lessonId, topic, skill, question: q }),
      })

      if (!res.ok) throw new Error('Failed to get answer')
      const data: DoubtResult = await res.json()
      setResult(data)
      setHistory(h => [...h, { q, r: data }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(199,125,255,0.2)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#1E2A42' }}>
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: '#C77DFF' }} />
          <span className="font-display font-bold text-sm">Ask a Doubt</span>
          <span className="text-xs px-2 py-0.5 rounded-sm"
            style={{ background: 'rgba(199,125,255,0.1)', color: '#C77DFF' }}>24/7 AI</span>
        </div>
        {onClose && <button onClick={onClose} style={{ color: '#6B7A99' }}><X size={15} /></button>}
      </div>

      {/* Input */}
      <div className="p-5">
        <div className="flex gap-3">
          <input type="text" value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleAsk()}
            placeholder={`Ask anything about ${topic}…`}
            className="flex-1 px-4 py-3 text-sm rounded-sm"
            style={{ background: '#141B2D', borderColor: '#1E2A42', color: '#E8EDF8' }}
          />
          <button onClick={handleAsk} disabled={loading || !question.trim()}
            className="px-4 py-3 rounded-sm flex items-center gap-2 text-sm font-bold disabled:opacity-40 transition-opacity"
            style={{ background: '#C77DFF', color: '#080B14' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        {error && <p className="mt-3 text-xs" style={{ color: '#FF6B6B' }}>{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="px-5 pb-5 space-y-4">
          <div className="p-4 rounded-sm" style={{ background: '#141B2D', border: '1px solid #1E2A42' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#4FFFA0' }}>💬 EXPLANATION</p>
            <p className="text-sm leading-relaxed" style={{ color: '#C4CFEA' }}>{result.answer}</p>
          </div>
          <div className="p-4 rounded-sm" style={{ background: 'rgba(255,209,102,0.05)', border: '1px solid rgba(255,209,102,0.2)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#FFD166' }}>💡 ANALOGY</p>
            <p className="text-sm leading-relaxed" style={{ color: '#C4CFEA' }}>{result.analogy}</p>
          </div>
          {result.code_example && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#5B8EFF' }}>💻 CODE EXAMPLE</p>
              <CodeBlock code={result.code_example} language={skill.toLowerCase()} />
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: '#1E2A42' }}>
          <p className="text-xs font-bold mt-4 mb-3" style={{ color: '#6B7A99' }}>PREVIOUS QUESTIONS</p>
          <div className="flex flex-col gap-2">
            {history.slice(0, -1).map((item, i) => (
              <button key={i} onClick={() => setResult(item.r)}
                className="text-left text-xs px-3 py-2 rounded-sm transition-colors hover:bg-white/5"
                style={{ color: '#6B7A99', border: '1px solid #1E2A42' }}>
                {item.q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}