import Link from 'next/link'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-app-border)] bg-[color-mix(in_oklab,var(--color-app-surface)_85%,transparent)]/95 backdrop-blur-md">
      <SectionContainer className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--color-app-text-primary)]">
          SkillMentor AI
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/dashboard" className="text-sm font-medium text-[var(--color-app-text-secondary)] transition-colors hover:text-[var(--color-app-text-primary)]">
            Dashboard
          </Link>
          <Link href="/roadmap" className="text-sm font-medium text-[var(--color-app-text-secondary)] transition-colors hover:text-[var(--color-app-text-primary)]">
            Roadmap
          </Link>
          <Link href="/daily-challenge" className="text-sm font-medium text-[var(--color-app-text-secondary)] transition-colors hover:text-[var(--color-app-text-primary)]">
            Daily Challenge
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/auth/login" className={buttonClassName({ variant: 'secondary' })}>
            Sign in
          </Link>
          <Link href="/auth/register" className={buttonClassName()}>
            Get started
          </Link>
        </div>
      </SectionContainer>
    </header>
  )
}
