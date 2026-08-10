import { fetchApi } from '@/lib/api-client';

export const ProjectService = {
  getProject: (projectId: string) =>
    fetchApi<any>(`/api/projects/${projectId}`),

  assignProject: (params: { user_id: string; roadmap_id: string; skill: string; level: string }) =>
    fetchApi<any>(`/api/projects/assign`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getUserProjects: (userId: string, roadmapId: string, limit: number = 5) =>
    fetchApi<any>(`/api/projects/user/${userId}?roadmap_id=${roadmapId}&limit=${limit}`),

  reviewProject: (params: { project_id: string; user_id: string; submitted_code: string; github_url: string }) =>
    fetchApi<any>(`/api/projects/review`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getProjectHint: (params: { project_id: string; user_id: string; question: string }) =>
    fetchApi<any>(`/api/projects/hint`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
