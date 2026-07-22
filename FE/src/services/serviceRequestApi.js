import httpClient from './httpClient';

export async function getServiceRequests(params = {}) {
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return httpClient.get(`/service-requests${query}`);
}

export async function getServiceRequestUnreadCount() {
  return httpClient.get('/service-requests/unread-count');
}

export async function getServiceRequestById(id) {
  return httpClient.get(`/service-requests/${id}`);
}

export async function acceptServiceRequest(id) {
  return httpClient.patch(`/service-requests/${id}/accept`);
}

export async function createAppointment(id, payload) {
  return httpClient.post(`/service-requests/${id}/appointments`, payload);
}

export async function updateAppointment(id, appointmentId, payload) {
  return httpClient.put(`/service-requests/${id}/appointments/${appointmentId}`, payload);
}

export async function cancelAppointment(id, appointmentId, reason) {
  return httpClient.patch(`/service-requests/${id}/appointments/${appointmentId}/cancel`, { reason });
}
