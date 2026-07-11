import httpClient from './httpClient';

export async function listRepairOrdersApi() {
  const data = await httpClient.get('/repair-orders');
  return data.data; // RepairOrder[]
}

export async function getRepairOrderApi(id) {
  const data = await httpClient.get(`/repair-orders/${id}`);
  return data.data;
}

export async function listTeamLeadersApi() {
  const data = await httpClient.get('/repair-orders/team-leaders');
  return data.data; // [{ id, pseudoId, fullName, phone, specialty, teamSize }]
}

export async function createRepairOrderApi(payload) {
  const data = await httpClient.post('/repair-orders', payload);
  return data.data;
}
