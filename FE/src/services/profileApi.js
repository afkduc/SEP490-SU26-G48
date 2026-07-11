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
