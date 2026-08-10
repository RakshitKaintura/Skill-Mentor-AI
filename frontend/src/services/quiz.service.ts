import { fetchApi } from '@/lib/api-client';

export const QuizService = {
  generateQuiz: (params: any) =>
    fetchApi<any>(`/api/quiz/generate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  submitQuiz: (params: any) =>
    fetchApi<any>(`/api/quiz/submit`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getQuizById: (quizId: string) =>
    fetchApi<any>(`/api/quiz/${quizId}`),
};
