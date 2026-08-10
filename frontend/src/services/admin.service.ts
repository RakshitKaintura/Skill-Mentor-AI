export const AdminService = {
  getStats: async () => {
    const response = await fetch(`/api/admin/stats`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Admin stats failed');
    }
    return response.json();
  }
};
