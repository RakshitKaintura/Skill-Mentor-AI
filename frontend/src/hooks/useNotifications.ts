'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Notification } from '@/types/week5'
import { DailyService } from '@/services/daily.service'

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const data = await DailyService.getNotifications(userId)
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.count || 0)
      }
    } catch { /* silent */ }
  }, [userId])

  useEffect(() => {
    const initial = setTimeout(() => {
      void fetchNotifications()
    }, 0)
    // Poll every 60 seconds
    const interval = setInterval(() => {
      void fetchNotifications()
    }, 60_000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [fetchNotifications])

  const markRead = useCallback(async (ids?: string[]) => {
    if (!userId) return
    try {
      await DailyService.markNotificationsRead({
        user_id: userId,
        notification_ids: ids,
      })
      setNotifications(prev =>
        ids
          ? prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n)
          : prev.map(n => ({ ...n, read: true }))
      )
      setUnreadCount(0)
    } catch { /* silent */ }
  }, [userId])

  return { notifications, unreadCount, fetchNotifications, markRead }
}