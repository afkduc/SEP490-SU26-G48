import httpClient from './httpClient';

export async function listRepairSettlementsApi({ status, search, page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);
  const data = await httpClient.get(`/repair-settlements?${params.toString()}`);
  return data.data; // { items: [...], total, page, limit }
}

export async function getRepairSettlementApi(id) {
  const data = await httpClient.get(`/repair-settlements/${id}`);
  return data.data;
}

export async function createRepairSettlementApi(payload) {
  const data = await httpClient.post('/repair-settlements', payload);
  return data.data;
}

export async function updateRepairSettlementApi(id, payload) {
  const data = await httpClient.put(`/repair-settlements/${id}`, payload);
  return data.data;
}

export async function updateRepairSettlementStatusApi(id, status) {
  const data = await httpClient.patch(`/repair-settlements/${id}/status`, { status });
  return data.data;
}
