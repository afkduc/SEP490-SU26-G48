import httpClient from './httpClient';

export async function getAdminDashboardStats() {
  const res = await httpClient.get('/admin/dashboard');
  return res?.data;
}

export async function listAdminUsers() {
  const res = await httpClient.get('/admin/users');
  return res?.data;
}