'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import NotificationBell from '@/components/NotificationBell'

const NAV = [
  { href: '/dashboard',  label: 'Home'     },
  { href: '/roadmap',    label: 'Roadmap'  },
  { href: '/lesson',     label: 'Lessons'  },
  { href: '/progress',   label: 'Progress' },
  { href: '/career',     label: 'Career'   },
]

export default function DashboardNavbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, signOut } = useAuth()

  return (
    <nav className="border-b border-brand-border bg-brand-surface sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="font-display font-black text-lg">
          <span className="text-brand-green">Skill</span>
          <span className="text-brand-text">Mentor</span>
          <span className="text-brand-muted font-mono text-xs ml-1">AI</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded font-mono text-xs transition-colors ${
                pathname.startsWith(n.href)
                  ? 'text-brand-green bg-brand-green/10'
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-bg'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && <NotificationBell userId={user.id} />}
          <Link
            href="/leaderboard"
            className="text-brand-muted hover:text-brand-yellow font-mono text-xs transition-colors hidden md:block"
          >
            🏆
          </Link>
          <button
            onClick={() => signOut().then(() => router.push('/'))}
            className="text-brand-muted hover:text-brand-red font-mono text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}