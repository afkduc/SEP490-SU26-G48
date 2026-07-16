import httpClient from './httpClient';

export async function listMaintenanceRemindersApi({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString();
  return httpClient.get(`/maintenance-reminders${qs ? `?${qs}` : ''}`);
}

export async function markMaintenanceReminderSentApi(id, notes) {
  return httpClient.patch(`/maintenance-reminders/${id}/sent`, { notes });
}

export async function markMaintenanceReminderConfirmedApi(id, { confirmedDate, notes } = {}) {
  return httpClient.patch(`/maintenance-reminders/${id}/confirmed`, { confirmedDate, notes });
}
