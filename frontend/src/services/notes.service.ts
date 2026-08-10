import { fetchApi } from '@/lib/api-client';

export const NotesService = {
  fetchNotes: (params: URLSearchParams) =>
    fetchApi<any>(`/api/notes?${params.toString()}`),

  createNote: (params: any) =>
    fetchApi<any>(`/api/notes`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  updateNote: (id: string, userId: string, params: any) =>
    fetchApi<any>(`/api/notes/${id}?user_id=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    }),

  deleteNote: (id: string, userId: string) =>
    fetchApi<any>(`/api/notes/${id}?user_id=${userId}`, {
      method: 'DELETE',
    }),

  summarizeNotes: (params: any) =>
    fetchApi<any>(`/api/notes/summarize`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
