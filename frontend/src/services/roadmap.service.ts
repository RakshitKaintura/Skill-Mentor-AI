import { fetchApi } from '@/lib/api-client';

export const RoadmapService = {
  generateRoadmap: (params: { user_id: string; skill: string; level: string; goal: string; hours_per_day: number; days_per_week?: number }) =>
    fetchApi<any>(`/api/roadmap/generate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
