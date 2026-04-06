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
    <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--color-app-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: 'color-mix(in oklab, var(--color-app-surface-cool) 70%, var(--color-app-surface) 30%)',
          borderBottom: '1px solid var(--color-app-border)',
        }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
          </div>
          {(title || language) && (
            <span className="text-xs" style={{ color: 'var(--color-app-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {title || language}
            </span>
          )}
        </div>
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs transition-all"
          style={{
            background: copied
              ? 'color-mix(in oklab, var(--color-app-surface-mint) 70%, var(--color-app-surface) 30%)'
              : 'var(--color-app-surface)',
            color: copied ? '#188038' : 'var(--color-app-text-secondary)',
            border: `1px solid ${copied
              ? 'color-mix(in oklab, #188038 40%, var(--color-app-border))'
              : 'var(--color-app-border)'}`,
          }}>
          {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy</>}
        </button>
      </div>

      {/* Code */}
      <div
        style={{
          background: 'color-mix(in oklab, var(--color-app-surface-cool) 74%, var(--color-app-surface) 26%)',
          maxHeight,
          overflowY: 'auto',
        }}
      >
        <pre className="p-4 text-xs leading-relaxed overflow-x-auto"
          style={{ fontFamily: 'var(--font-mono), Consolas, monospace', color: 'var(--color-app-text-primary)', margin: 0 }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

export default CodeBlock
