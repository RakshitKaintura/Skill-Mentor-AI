import { fetchApi } from '@/lib/api-client';
import type { Lesson, GenerateLessonParams } from '@/hooks/useLesson';

export const LessonService = {
  getLesson: (lessonId: string) => 
    fetchApi<Lesson>(`/api/lesson/${lessonId}`),
    
  generateLesson: (userId: string, params: GenerateLessonParams) =>
    fetchApi<{ lesson_id: string; message: string }>(`/api/lesson/generate`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, ...params }),
    }),
    
  completeLesson: (userId: string, lessonId: string, timeSpentMinutes: number = 0) =>
    fetchApi(`/api/lesson/${lessonId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, lesson_id: lessonId, time_spent_minutes: timeSpentMinutes }),
    }),
    
  generateNotes: (userId: string, lessonId: string) =>
    fetchApi<{ pdf_url: string }>(`/api/lesson/${lessonId}/notes?user_id=${userId}`, {
      method: 'POST',
    }),
    
  askDoubt: (params: { user_id: string; lesson_id?: string; topic: string; skill: string; question: string }) =>
    fetchApi<any>(`/api/lesson/doubt`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
    
  cleanupLessons: (userId: string) =>
    fetchApi(`/api/lesson/cleanup/${userId}`, {
      method: 'DELETE',
    }),
};
