import { fetchApi } from '@/lib/api-client';

export const DailyService = {
  getNotifications: (userId: string) =>
    fetchApi<any>(`/api/daily/notifications/${userId}`),

  markNotificationsRead: (params: { user_id: string; notification_ids?: string[] }) =>
    fetchApi<any>(`/api/daily/notifications/read`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getDailyChallenge: (userId: string, roadmapId: string, skill: string) =>
    fetchApi<any>(`/api/daily/challenge/${userId}?roadmap_id=${encodeURIComponent(roadmapId)}&skill=${encodeURIComponent(skill)}`),

  completeChallenge: (params: { challenge_id: string; user_id: string; answers?: any; score?: number; code?: string; theory?: string }) =>
    fetchApi<any>(`/api/daily/challenge/complete`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
