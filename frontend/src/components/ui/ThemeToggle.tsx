'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      disabled={!mounted}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-text-secondary)] transition-colors hover:bg-[var(--color-app-bg)] hover:text-[var(--color-app-text-primary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {!mounted ? <Moon className="h-4 w-4" /> : resolvedTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
