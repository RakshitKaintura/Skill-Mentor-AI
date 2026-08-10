import { fetchApi } from '@/lib/api-client';

export const PlaygroundService = {
  generateChallenge: (params: any) =>
    fetchApi<any>(`/api/playground/challenge/generate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  requestHint: (params: any) =>
    fetchApi<any>(`/api/playground/hint`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  evaluateCode: (params: any) =>
    fetchApi<any>(`/api/playground/evaluate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  explainError: (params: any) =>
    fetchApi<any>(`/api/playground/explain-error`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
