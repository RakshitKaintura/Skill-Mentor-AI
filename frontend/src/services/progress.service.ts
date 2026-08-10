import { fetchApi } from '@/lib/api-client';

export const ProgressService = {
  getDueReviews: (userId: string) =>
    fetchApi<any>(`/api/progress/due-reviews/${userId}`),

  getReportCard: (userId: string, roadmapId: string) =>
    fetchApi<any>(`/api/progress/report-card/${userId}?roadmap_id=${roadmapId}`),

  generateReportCard: (params: { user_id: string; roadmap_id: string; week_number: number }) =>
    fetchApi<any>(`/api/progress/report-card`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getLeaderboard: (limit: number = 50) =>
    fetchApi<any>(`/api/progress/leaderboard?limit=${limit}`),
};
