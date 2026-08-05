import httpClient from './httpClient';

export async function listRepairSettlementsApi({ status, search, customerId, vehicleId, fromDate, toDate, page = 1, limit = 100, scope } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (customerId) params.set('customerId', customerId);
  if (vehicleId) params.set('vehicleId', vehicleId);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (scope) params.set('scope', scope);
  params.set('page', page);
  params.set('limit', limit);
  return httpClient.get(`/repair-settlements?${params.toString()}`); // { items: [...], total, page, limit }
}

export async function getRepairSettlementApi(id) {
  return httpClient.get(`/repair-settlements/${id}`);
}

export async function checkDuplicateSettlementApi(customerId, vehicleId, excludeId) {
  const params = new URLSearchParams({ customerId, vehicleId });
  if (excludeId) params.set('excludeId', excludeId);
  return httpClient.get(`/repair-settlements/check-duplicate?${params.toString()}`);
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

/** Ghi audit khi in phiếu / danh sách công việc (best-effort, không chặn in). */
export async function logRepairSettlementPrintApi(id, kind = 'settlement') {
  return httpClient.post(`/repair-settlements/${id}/print-log`, { kind });
}

export async function createPayosPaymentLinkApi(id) {
  return httpClient.post(`/repair-settlements/${id}/payos/create-payment-link`);
}

