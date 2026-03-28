'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/types/week5'

interface NotificationBellProps { userId: string }

const typeEmoji: Record<string, string> = {
  streak:      '🔥',
  reminder:    '⏰',
  achievement: '🏆',
  report:      '📊',
  challenge:   '🎯',
  buddy:       '👥',
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markRead } = useNotifications(userId)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
  }

  const handleClick = async (notif: Notification) => {
    if (!notif.read) {
      await markRead([notif.id])
    }
    setOpen(false)
    if (notif.action_url) router.push(notif.action_url)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-lg border border-brand-border flex items-center justify-center text-brand-muted hover:text-brand-text hover:border-brand-green/40 transition-colors"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red text-white text-xs rounded-full flex items-center justify-center font-mono">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-brand-surface border border-brand-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
            <span className="text-brand-text font-mono text-sm font-bold">Notifications</span>
            {unreadCount > 0 && notifications.length > 0 && (
              <button
                onClick={() => markRead()}
                className="text-brand-muted font-mono text-xs hover:text-brand-text"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-brand-muted font-mono text-xs">
              No notifications
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-brand-border/50 hover:bg-brand-bg transition-colors ${
                    !n.read ? 'bg-brand-green/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{typeEmoji[n.type] || '📢'}</span>
                    <div className="min-w-0">
                      <div className="text-brand-text font-mono text-xs font-medium truncate">{n.title}</div>
                      <div className="text-brand-muted font-mono text-xs leading-relaxed line-clamp-2 mt-0.5">
                        {n.message}
                      </div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}