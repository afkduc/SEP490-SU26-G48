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

// Dich vu (hoac goi bao duong, voi PM) da dung trong 1 loai hinh sua chua -
// cung bo loc voi overview de so phieu khop bang "Hieu suat theo loai hinh".
export async function getRepairCategoryServicesApi(repairCategory, { fromDate, toDate, status } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (status) params.set('status', status);
  const qs = params.toString();
  return httpClient.get(`/dashboard/repair-categories/${encodeURIComponent(repairCategory)}/services${qs ? `?${qs}` : ''}`);
}
