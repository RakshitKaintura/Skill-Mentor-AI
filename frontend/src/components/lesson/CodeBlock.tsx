'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  code:       string
  language?:  string
  title?:     string
  maxHeight?: number
}

export function CodeBlock({ code, language = 'javascript', title, maxHeight = 400 }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-sm overflow-hidden" style={{ border: '1px solid #1E2A42' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: '#0A1020', borderBottom: '1px solid #1E2A42' }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
          </div>
          {(title || language) && (
            <span className="text-xs" style={{ color: '#6B7A99', fontFamily: 'var(--font-dm-mono)' }}>
              {title || language}
            </span>
          )}
        </div>
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs transition-all"
          style={{
            background: copied ? 'rgba(79,255,160,0.1)' : 'rgba(255,255,255,0.05)',
            color:      copied ? '#4FFFA0' : '#6B7A99',
            border:     `1px solid ${copied ? 'rgba(79,255,160,0.3)' : '#1E2A42'}`,
          }}>
          {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy</>}
        </button>
      </div>

      {/* Code */}
      <div style={{ background: '#080D18', maxHeight, overflowY: 'auto' }}>
        <pre className="p-4 text-xs leading-relaxed overflow-x-auto"
          style={{ fontFamily: 'var(--font-dm-mono), Consolas, monospace', color: '#E8EDF8', margin: 0 }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}