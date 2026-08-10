import { fetchApi } from '@/lib/api-client';

export const CareerService = {
  getJobReadiness: (userId: string, roadmapId: string) =>
    fetchApi<any>(`/api/career/job-readiness/${userId}?roadmap_id=${roadmapId}`),

  generateCertificate: (params: { user_id: string; roadmap_id: string; skill: string; level: string; full_name: string }) =>
    fetchApi<any>(`/api/career/certificate/generate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  verifyCertificate: (code: string) =>
    fetchApi<any>(`/api/career/certificate/verify/${code}`),

  reviewResume: (params: { user_id: string; roadmap_id: string; skill: string; target_role: string; resume_text: string }) =>
    fetchApi<any>(`/api/career/resume/review`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  startInterview: (params: { user_id: string; roadmap_id: string; skill: string; level: string; interview_type: string; company_target?: string; num_questions?: number }) =>
    fetchApi<any>(`/api/career/interview/start`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  evaluateAnswer: (params: { session_id: string; question_id: number; question_text: string; answer: string; key_points: string[]; skill: string; level: string }) =>
    fetchApi<any>(`/api/career/interview/evaluate-answer`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  completeInterview: (params: { session_id: string; user_id: string; answers: any[]; evaluations: any[] }) =>
    fetchApi<any>(`/api/career/interview/complete`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
