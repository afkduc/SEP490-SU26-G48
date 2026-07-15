import httpClient from './httpClient';

export async function getDashboardOverviewApi({ fromDate, toDate, status, categoryId } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (status) params.set('status', status);
  if (categoryId) params.set('categoryId', categoryId);
  const qs = params.toString();
  return httpClient.get(`/dashboard/overview${qs ? `?${qs}` : ''}`);
}
