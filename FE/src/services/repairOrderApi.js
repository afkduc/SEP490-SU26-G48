import httpClient from './httpClient';

export async function listRepairOrdersApi() {
  return httpClient.get('/repair-orders'); // RepairOrder[]
}

export async function getRepairOrderApi(id) {
  return httpClient.get(`/repair-orders/${id}`);
}

export async function listTeamLeadersApi() {
  return httpClient.get('/repair-orders/team-leaders'); // [{ id, pseudoId, fullName, phone, specialty, teamSize }]
}

export async function createRepairOrderApi(payload) {
  return httpClient.post('/repair-orders', payload);
}

export async function updateRepairOrderStatusApi(id, status, reason) {
  return httpClient.patch(`/repair-orders/${id}/status`, { status, reason });
}
