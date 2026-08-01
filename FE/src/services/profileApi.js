import httpClient from './httpClient';

/**
 * Profile API
 *   - getMyProfile(): GET /api/profile/me
 *   - updateMyProfile(payload): PUT /api/profile/me
 *   - logoutAllMyDevices(): POST /api/profile/me/devices/logout-all
 * Self change-password and device trust removed.
 */
export async function getMyProfile() {
  return httpClient.get('/profile/me');
}

export async function updateMyProfile(payload) {
  return httpClient.put('/profile/me', payload);
}

/** POST /api/profile/me/devices/logout-all — đăng xuất mọi thiết bị của chính mình */
export async function logoutAllMyDevices() {
  return httpClient.post('/profile/me/devices/logout-all');
}
