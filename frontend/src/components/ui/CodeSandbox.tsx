'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Square, Trash2, Copy, CheckCheck, AlertTriangle, Terminal, ChevronDown, Loader2, Sparkles } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

type Language = 'python' | 'javascript' | 'typescript' | 'c' | 'cpp' | 'java' | 'go' | 'rust'

interface ExecuteResult {
  stdout: string
  stderr: string
  exit_code: number
  execution_time_ms: number
}

interface Props {
  initialCode?: string
  initialLanguage?: Language
  /** Called when "Analyze Error with AI" is clicked — passes the stderr text */
  onAnalyzeError?: (stderr: string, code: string) => void
  className?: string
}

// ── Language metadata ─────────────────────────────────────────

const LANGUAGES: { value: Language; label: string; extension: string; starter: string }[] = [
  {
    value: 'python', label: 'Python', extension: '.py',
    starter: '# Write your Python code here\nprint("Hello, World!")\n\n# Try: variables, loops, functions...\nfor i in range(1, 6):\n    print(f"Count: {i}")',
  },
  {
    value: 'javascript', label: 'JavaScript', extension: '.js',
    starter: '// Write your JavaScript code here\nconsole.log("Hello, World!");\n\n// Try: arrays, functions, promises...\nconst nums = [1, 2, 3, 4, 5];\nconsole.log("Sum:", nums.reduce((a, b) => a + b, 0));',
  },
  {
    value: 'typescript', label: 'TypeScript', extension: '.ts',
    starter: '// Write your TypeScript code here\nconst greet = (name: string): string => {\n  return `Hello, ${name}!`;\n};\nconsole.log(greet("World"));',
  },
  {
    value: 'c', label: 'C', extension: '.c',
    starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  },
  {
    value: 'cpp', label: 'C++', extension: '.cpp',
    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
  },
  {
    value: 'java', label: 'Java', extension: '.java',
    starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  },
  {
    value: 'go', label: 'Go', extension: '.go',
    starter: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}',
  },
  {
    value: 'rust', label: 'Rust', extension: '.rs',
    starter: 'fn main() {\n    println!("Hello, World!");\n}',
  },
]

// ── Helpers ───────────────────────────────────────────────────

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

// ── Sub-components ────────────────────────────────────────────

function OutputLine({ line, isError }: { line: string; isError: boolean }) {
  if (!line.trim() && !line.includes('\n')) return null
  return (
    <div className={`font-mono text-sm leading-relaxed ${isError ? 'text-red-400' : 'text-[#c8d3f5]'}`}>
      <span className="select-none mr-2" style={{ color: isError ? '#ff6b6b80' : '#5B8EFF80' }}>
        {isError ? '✗' : '›'}
      </span>
      {line}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function CodeSandbox({
  initialCode,
  initialLanguage = 'python',
  onAnalyzeError,
  className = '',
}: Props) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const [code, setCode] = useState(
    initialCode ?? LANGUAGES.find(l => l.value === initialLanguage)?.starter ?? ''
  )
  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showOutput, setShowOutput] = useState(true)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [runCount, setRunCount] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const currentLang = LANGUAGES.find(l => l.value === language)!

  // Sync starter code when language changes
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setCode(LANGUAGES.find(l => l.value === lang)?.starter ?? '')
    setResult(null)
    setError(null)
    setLangMenuOpen(false)
  }

  // Tab key support in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = code.substring(0, start) + '    ' + code.substring(end)
      setCode(newCode)
      // restore cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4
          textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
    // Ctrl+Enter or Cmd+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  const handleRun = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setError(null)
    setResult(null)
    setShowOutput(true)
    setRunCount(c => c + 1)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${getApiBase()}/api/v1/sandbox/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin: '' }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error: ${res.status}`)
      }

      const data: ExecuteResult = await res.json()
      setResult(data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, language, code])

  const handleStop = () => {
    abortRef.current?.abort()
    setIsRunning(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setCode(currentLang.starter)
    setResult(null)
    setError(null)
  }

  // Auto-scroll output
  useEffect(() => {
    if (result || error) {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [result, error])

  const hasError = result && (result.exit_code !== 0 || result.stderr.trim().length > 0)
  const isSuccess = result && result.exit_code === 0

  return (
    <div
      className={`rounded-2xl overflow-hidden border flex flex-col ${className}`}
      style={{
        borderColor: isRunning
          ? 'color-mix(in oklab, var(--color-app-primary) 40%, var(--color-app-border))'
          : hasError
          ? 'color-mix(in oklab, #ff6b6b 30%, var(--color-app-border))'
          : isSuccess
          ? 'color-mix(in oklab, #4FFFA0 22%, var(--color-app-border))'
          : 'var(--color-app-border)',
        background: 'var(--color-app-surface)',
        boxShadow: isRunning
          ? '0 0 0 3px color-mix(in oklab, var(--color-app-primary) 10%, transparent)'
          : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-wrap"
        style={{ borderColor: 'var(--color-app-border)', background: 'color-mix(in oklab, var(--color-app-surface) 60%, #080b14 40%)' }}
      >
        {/* macOS dots */}
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>

        {/* Language selector */}
        <div className="relative ml-2">
          <button
            onClick={() => setLangMenuOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-90"
            style={{
              borderColor: 'var(--color-app-border)',
              background: 'color-mix(in oklab, var(--color-app-primary) 8%, var(--color-app-surface))',
              color: 'var(--color-app-primary)',
            }}
          >
            {currentLang.label}
            <ChevronDown size={11} />
          </button>
          {langMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1 z-50 rounded-lg border overflow-hidden shadow-2xl"
              style={{ borderColor: 'var(--color-app-border)', background: 'var(--color-app-surface)', minWidth: '130px' }}
            >
              {LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--color-app-primary)_10%,var(--color-app-surface))]"
                  style={{
                    color: lang.value === language ? 'var(--color-app-primary)' : 'var(--color-app-text-secondary)',
                    fontWeight: lang.value === language ? 700 : 400,
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filename badge */}
        <span className="text-xs font-mono" style={{ color: 'var(--color-app-text-secondary)' }}>
          main{currentLang.extension}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ color: 'var(--color-app-text-secondary)' }}
          >
            {copied ? <CheckCheck size={14} style={{ color: '#4FFFA0' }} /> : <Copy size={14} />}
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            title="Reset code"
            className="p-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ color: 'var(--color-app-text-secondary)' }}
          >
            <Trash2 size={14} />
          </button>

          {/* Run / Stop */}
          <button
            onClick={isRunning ? handleStop : handleRun}
            disabled={!code.trim()}
            title={isRunning ? 'Stop (Esc)' : 'Run (Ctrl+Enter)'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
            style={{
              background: isRunning
                ? 'color-mix(in oklab, #ff6b6b 18%, var(--color-app-surface))'
                : 'color-mix(in oklab, var(--color-app-primary) 18%, var(--color-app-surface))',
              color: isRunning ? '#ff6b6b' : 'var(--color-app-primary)',
              border: `1px solid ${isRunning ? '#ff6b6b40' : 'color-mix(in oklab, var(--color-app-primary) 30%, var(--color-app-border))'}`,
            }}
          >
            {isRunning ? (
              <><Square size={11} fill="currentColor" /> Stop</>
            ) : (
              <><Play size={11} fill="currentColor" /> Run</>
            )}
          </button>
        </div>
      </div>

      {/* ── Code Editor (textarea) ── */}
      <div className="relative flex-1 min-h-[220px]">
        {/* Line numbers */}
        <div
          className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-end pr-2 pt-4 pb-4 overflow-hidden pointer-events-none select-none"
          style={{ background: 'color-mix(in oklab, #080b14 70%, var(--color-app-surface))', borderRight: '1px solid var(--color-app-border)' }}
          aria-hidden="true"
        >
          {code.split('\n').map((_, i) => (
            <div key={i} className="text-xs leading-6 font-mono" style={{ color: '#3d4a6a', lineHeight: '1.5rem' }}>
              {i + 1}
            </div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="w-full h-full min-h-[220px] resize-y font-mono text-sm leading-6 bg-transparent outline-none"
          style={{
            paddingTop: '1rem',
            paddingBottom: '1rem',
            paddingLeft: '3rem',
            paddingRight: '1rem',
            color: '#c8d3f5',
            caretColor: 'var(--color-app-primary)',
            background: 'color-mix(in oklab, #080b14 88%, var(--color-app-surface))',
          }}
        />

        {/* Running overlay pulse */}
        {isRunning && (
          <div className="absolute inset-0 pointer-events-none flex items-start justify-end p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold animate-pulse" style={{ color: 'var(--color-app-primary)' }}>
              <Loader2 size={11} className="animate-spin" />
              Executing…
            </span>
          </div>
        )}
      </div>

      {/* ── Output Panel ── */}
      {(result !== null || error !== null || isRunning) && (
        <div
          ref={outputRef}
          className="border-t"
          style={{ borderColor: 'var(--color-app-border)' }}
        >
          {/* Output header */}
          <button
            onClick={() => setShowOutput(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors hover:opacity-80"
            style={{
              color: hasError ? '#ff6b6b' : isSuccess ? '#4FFFA0' : 'var(--color-app-text-secondary)',
              background: 'color-mix(in oklab, #080b14 70%, var(--color-app-surface))',
            }}
          >
            <span className="flex items-center gap-2">
              <Terminal size={12} />
              {isRunning ? 'Running…' : hasError ? `Error — exit code ${result?.exit_code}` : `Output · Run #${runCount}`}
              {isRunning && <Loader2 size={10} className="animate-spin" />}
            </span>
            <ChevronDown
              size={12}
              style={{ transform: showOutput ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </button>

          {showOutput && !isRunning && (
            <div
              className="px-4 py-3 max-h-56 overflow-y-auto space-y-0.5"
              style={{
                background: '#060810',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1e2a42 transparent',
              }}
            >
              {/* Connection error */}
              {error && (
                <div className="flex items-start gap-2 text-sm font-mono text-red-400">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* stdout lines */}
              {result?.stdout && result.stdout.split('\n').filter(l => l !== '').map((line, i) => (
                <OutputLine key={`out-${i}`} line={line} isError={false} />
              ))}

              {/* Empty stdout but success */}
              {result && !result.stdout.trim() && !result.stderr.trim() && (
                <span className="text-xs font-mono" style={{ color: '#3d4a6a' }}>
                  (No output)
                </span>
              )}

              {/* stderr */}
              {result?.stderr && result.stderr.trim() && result.stderr.split('\n').filter(l => l !== '').map((line, i) => (
                <OutputLine key={`err-${i}`} line={line} isError={true} />
              ))}
            </div>
          )}

          {/* Analyze error CTA */}
          {!isRunning && hasError && onAnalyzeError && result?.stderr && (
            <div
              className="px-4 py-3 flex items-center justify-between border-t"
              style={{ borderColor: 'color-mix(in oklab, #ff6b6b 20%, var(--color-app-border))', background: 'color-mix(in oklab, #ff6b6b 5%, #060810)' }}
            >
              <span className="text-xs" style={{ color: '#ff6b6b80' }}>
                Runtime error detected in your code.
              </span>
              <button
                onClick={() => onAnalyzeError(result.stderr, code)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-[0.97]"
                style={{
                  background: 'color-mix(in oklab, var(--color-app-primary) 12%, #060810)',
                  color: 'var(--color-app-primary)',
                  border: '1px solid color-mix(in oklab, var(--color-app-primary) 28%, var(--color-app-border))',
                }}
              >
                <Sparkles size={11} />
                Analyze Error with AI
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Hint bar ── */}
      <div
        className="px-4 py-1.5 text-xs border-t flex items-center justify-between"
        style={{ borderColor: 'var(--color-app-border)', color: '#3d4a6a', background: 'color-mix(in oklab, #080b14 70%, var(--color-app-surface))' }}
      >
        <span>Tab to indent · Ctrl+Enter to run</span>
        <span>{code.split('\n').length} lines · {code.length} chars</span>
      </div>
    </div>
  )
}
