'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { 
  LayoutDashboard, Map, BarChart2, Trophy, 
  LogOut, Menu, X, Flame, Star, Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  userName: string
  streakDays?: number
  xpPoints?: number
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/roadmap', label: 'Roadmap', Icon: Map },
  { href: '/progress', label: 'Progress', Icon: BarChart2 },
  { href: '/achievements', label: 'Achievements', Icon: Trophy },
]

export function DashboardNavbar({ userName, streakDays = 0, xpPoints = 0 }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initial = userName?.[0]?.toUpperCase() ?? 'U'

  return (
    <nav className="sticky top-0 z-50 border-b border-brand-border bg-brand-bg/95 backdrop-blur-lg">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/dashboard" className="font-display font-black text-lg gradient-text flex-shrink-0">
          SkillMentor AI
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map(({ href, label, Icon }) => {
            const isActive = pathname === href
            return (
              <Link 
                key={href} 
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs transition-colors",
                  isActive 
                    ? "bg-brand-green/10 text-brand-green" 
                    : "text-brand-muted hover:text-brand-text hover:bg-white/5"
                )}
              >
                <Icon size={12} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* User Stats & Profile */}
        <div className="flex items-center gap-3">
          {/* Streak Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow">
            <Flame size={12} />
            {streakDays}
          </div>

          {/* XP Display */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold bg-brand-purple/10 border border-brand-purple/20 text-brand-purple">
            <Star size={12} />
            {xpPoints} XP
          </div>

          {/* Avatar Dropdown */}
          <div className="relative group">
            <button className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm bg-brand-green text-brand-bg hover:scale-105 transition-transform">
              {initial}
            </button>
            
            {/* Popover Menu */}
            <div className="absolute right-0 top-10 w-48 rounded-sm border border-brand-border bg-brand-surface shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
              <div className="px-4 py-3 border-b border-brand-border">
                <p className="text-xs font-bold text-brand-text truncate">{userName}</p>
                <p className="text-[10px] text-brand-muted uppercase tracking-wider">Student</p>
              </div>
              
              <Link href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-xs text-brand-muted hover:bg-white/5 hover:text-brand-text transition-colors">
                <Settings size={12} />
                Settings
              </Link>
              
              <button 
                onClick={logout} 
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-brand-red hover:bg-brand-red/5 transition-colors"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-brand-muted hover:text-brand-text" 
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {open && (
        <div className="md:hidden border-t border-brand-border bg-brand-bg px-5 py-4 flex flex-col gap-2 animate-fade-up">
          {LINKS.map(({ href, label, Icon }) => (
            <Link 
              key={href} 
              href={href} 
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-sm text-sm",
                pathname === href ? "text-brand-green bg-brand-green/5" : "text-brand-muted"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <div className="h-px bg-brand-border my-2" />
          <button 
            onClick={logout} 
            className="flex items-center gap-3 px-3 py-3 text-sm text-brand-red"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}