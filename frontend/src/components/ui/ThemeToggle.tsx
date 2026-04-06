'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light'

    document.documentElement.setAttribute('data-theme', initial)
    setTheme(initial)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      disabled={!mounted}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-text-secondary)] transition-colors hover:bg-[var(--color-app-bg)] hover:text-[var(--color-app-text-primary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {!mounted ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
