'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ui/ThemeToggle'
import SectionContainer from '@/components/ui/SectionContainer'
import { 
  LayoutDashboard, Map, BarChart2, Trophy, 
  LogOut, Menu, X, Flame, Star, Settings, Shield, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  userName?: string
  streakDays?: number
  xpPoints?: number
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/skills', label: 'My Skills', Icon: BookOpen },
  { href: '/daily-challenge', label: 'Daily Challenge', Icon: Flame },
  { href: '/roadmap', label: 'Roadmap', Icon: Map },
  { href: '/progress', label: 'Progress', Icon: BarChart2 },
  { href: '/achievements', label: 'Achievements', Icon: Trophy },
  { href: '/admin', label: 'Admin', Icon: Shield },
]

export function DashboardNavbar({ userName, streakDays = 0, xpPoints = 0 }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(userName ?? '')
  const [displayStreak, setDisplayStreak] = useState(streakDays)
  const [displayXp, setDisplayXp] = useState(xpPoints)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const isSupabaseLockAbort = (error: unknown) => {
    if (!(error instanceof Error)) return false
    return (
      error.name === 'AbortError' &&
      error.message.includes("Lock broken by another request with the 'steal' option")
    )
  }

  useEffect(() => {
    let mounted = true

    const hydrateStats = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const uid = authData.user?.id
        if (uid && mounted) setCurrentUserId(uid)

        // Prefer page-provided values when present.
        if (userName) setDisplayName(userName)
        if (typeof streakDays === 'number') setDisplayStreak(streakDays)
        if (typeof xpPoints === 'number') setDisplayXp(xpPoints)

        // If all values are provided, no need to fetch.
        if (userName && streakDays > 0 && xpPoints > 0) return

        if (!uid || !mounted) return

        const [profileRes, progressRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', uid).single(),
          supabase.from('user_progress').select('streak_days,xp_points').eq('user_id', uid).single(),
        ])

        if (!mounted) return
        const fullName = profileRes.data?.full_name
        if (fullName) setDisplayName(fullName)
        setDisplayStreak(progressRes.data?.streak_days ?? streakDays ?? 0)
        setDisplayXp(progressRes.data?.xp_points ?? xpPoints ?? 0)
      } catch (error) {
        if (!isSupabaseLockAbort(error)) {
          console.error('[DashboardNavbar] Failed to hydrate stats:', error)
        }
      }
    }

    hydrateStats()
    return () => {
      mounted = false
    }
  }, [supabase, userName, streakDays, xpPoints])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initial = displayName?.[0]?.toUpperCase() ?? 'U'

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-app-border)] bg-[color-mix(in_oklab,var(--color-app-surface)_86%,transparent)]/95 backdrop-blur-md">
      <SectionContainer className="flex h-16 items-center justify-between">
        
        {/* Logo */}
        <Link href="/dashboard" className="text-lg font-semibold text-[var(--color-app-text-primary)]">
          SkillMentor AI
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          {LINKS.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link 
                key={href} 
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "neo-surface text-[var(--color-app-primary)]" 
                    : "text-[var(--color-app-text-secondary)] hover:-translate-y-0.5 hover:bg-[var(--color-app-bg)] hover:text-[var(--color-app-text-primary)]"
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* User Stats & Profile */}
        <div className="flex items-center gap-2">
          {currentUserId && <NotificationBell userId={currentUserId} />}

          <ThemeToggle />

          {/* Streak Counter */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-app-text-secondary)]">
            <Flame size={12} />
            {displayStreak}
          </div>

          {/* XP Display */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-app-text-secondary)]">
            <Star size={12} />
            {displayXp} XP
          </div>

          {/* Avatar Dropdown */}
          <div className="relative group">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(140deg,var(--card-accent-start),var(--card-accent-end))] text-sm font-semibold text-white shadow-[0_10px_20px_color-mix(in_oklab,var(--card-accent-start)_30%,transparent)] transition-transform hover:scale-105">
              {initial}
            </button>
            
            {/* Popover Menu */}
            <div className="pointer-events-none absolute right-0 top-10 w-52 translate-y-2 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface)] opacity-0 shadow-sm transition-all duration-200 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
              <div className="border-b border-[var(--color-app-border)] px-4 py-3">
                <p className="truncate text-sm font-semibold text-[var(--color-app-text-primary)]">{displayName}</p>
                <p className="text-xs text-[var(--color-app-text-secondary)]">Student</p>
              </div>
              
              <Link href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-app-text-secondary)] transition-colors hover:bg-[var(--color-app-bg)] hover:text-[var(--color-app-text-primary)]">
                <Settings size={14} />
                Settings
              </Link>
              
              <button 
                onClick={logout} 
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="text-[var(--color-app-text-secondary)] hover:text-[var(--color-app-text-primary)] md:hidden" 
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </SectionContainer>

      {/* Mobile Menu Overlay */}
      {open && (
        <div className="animate-fade-up border-t border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-5 py-4 md:hidden">
          {LINKS.map(({ href, label, Icon }) => (
            <Link 
              key={href} 
              href={href} 
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm",
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "bg-[#e8f0fe] text-[var(--color-app-primary)]"
                  : "text-[var(--color-app-text-secondary)]"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <div className="my-2 h-px bg-[var(--color-app-border)]" />
          <button 
            onClick={logout} 
            className="flex items-center gap-3 px-3 py-3 text-sm text-red-500"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}

export default DashboardNavbar
