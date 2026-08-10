export const AnalyticsService = {
  trackEvent: async (params: { user_id?: string; event_type: string; event_data?: any; page?: string; session_id?: string }) => {
    const response = await fetch(`/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error('Analytics track failed');
    }
    return response.json();
  }
};
