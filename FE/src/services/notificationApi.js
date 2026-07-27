import httpClient from './httpClient';

function buildQuery(params) {
  if (!params || Object.keys(params).length === 0) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  }
  return `?${query.toString()}`;
}

export async function getNotificationSettings() {
  return httpClient.get('/profile/me/notifications/settings');
}

export async function updateNotificationSettings(settings) {
  return httpClient.put('/profile/me/notifications/settings', settings);
}

export async function getNotifications(params = {}) {
  return httpClient.get(`/profile/me/notifications${buildQuery(params)}`);
}

export async function markAsRead(notificationId) {
  return httpClient.patch(`/profile/me/notifications/${notificationId}/read`);
}

export async function markAllAsRead() {
  return httpClient.patch('/profile/me/notifications/read-all');
}

export async function getUnreadCount() {
  return httpClient.get('/profile/me/notifications/unread-count');
}
