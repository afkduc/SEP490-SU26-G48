import httpClient from './httpClient';

export async function listRepairSettlementsApi({ status, search, customerId, vehicleId, page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (customerId) params.set('customerId', customerId);
  if (vehicleId) params.set('vehicleId', vehicleId);
  params.set('page', page);
  params.set('limit', limit);
  return httpClient.get(`/repair-settlements?${params.toString()}`); // { items: [...], total, page, limit }
}

export async function getRepairSettlementApi(id) {
  return httpClient.get(`/repair-settlements/${id}`);
}

export async function createRepairSettlementApi(payload) {
  return httpClient.post('/repair-settlements', payload);
}

export async function updateRepairSettlementApi(id, payload) {
  return httpClient.put(`/repair-settlements/${id}`, payload);
}

export async function updateRepairSettlementStatusApi(id, status, reason) {
  return httpClient.patch(`/repair-settlements/${id}/status`, { status, reason });
}
