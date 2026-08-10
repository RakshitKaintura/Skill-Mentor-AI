import { fetchApi } from '@/lib/api-client';

export const SandboxService = {
  executeCode: (params: { code: string; language: string; stdin?: string; expected_output?: string }, signal?: AbortSignal) =>
    fetchApi<any>(`/api/v1/sandbox/execute`, {
      method: 'POST',
      body: JSON.stringify(params),
      signal,
    }),
};
