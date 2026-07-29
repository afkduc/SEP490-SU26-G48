import httpClient from './httpClient';

/**
 * Profile API
 *   - getMyProfile():   GET /api/profile/me
 *     tra ve: { id, userName, email, firstName, lastName, phone, branchId, branchName, status, roles, createdAt, updatedAt }
 *   - updateMyProfile(payload): PUT /api/profile/me
 *     payload: { email, firstName, lastName, phone }
 *     tra ve: profile object
 *   - changePassword(payload): PUT /api/profile/me/password
 *     payload: { currentPassword, newPassword }
 *     tra ve: null
 */
export async function getMyProfile() {
  return httpClient.get('/profile/me');
}

export async function updateMyProfile(payload) {
  return httpClient.put('/profile/me', payload);
}

export async function changePassword(payload) {
  return httpClient.put('/profile/me/password', payload);
}

/** GET /api/profile/me/devices */
export async function getMyDevices() {
  return httpClient.get('/profile/me/devices');
}

/** PATCH /api/profile/me/devices/:id/trust { trusted: boolean } */
export async function setMyDeviceTrusted(deviceId, trusted) {
  return httpClient.patch(`/profile/me/devices/${deviceId}/trust`, { trusted: Boolean(trusted) });
}

/** DELETE /api/profile/me/devices/all — đăng xuất mọi thiết bị của chính mình */
export async function logoutAllMyDevices() {
  return httpClient.delete('/profile/me/devices/all');
}
