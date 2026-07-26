import httpClient from './httpClient';

export async function loginApi(identifier, password, branchId, { force = false } = {}) {
  const data = await httpClient.post(
    '/auth/login',
    { identifier, email: identifier, password, branchId, force: Boolean(force) },
    { omitAuth: true, skipSessionExpired: true }
  );
  return data; // { token, user }
}

export async function forgotPasswordApi(email) {
  return httpClient.post(
    '/auth/forgot-password',
    { email },
    { omitAuth: true, skipSessionExpired: true }
  );
}

export async function resetPasswordApi(token, newPassword) {
  return httpClient.post(
    '/auth/reset-password',
    { token, newPassword },
    { omitAuth: true, skipSessionExpired: true }
  );
}

export async function logoutApi() {
  // PHIEN quan trong: phai goi de BE trackLogout cap nhat DB (status='ended',
  // logout_time, session_duration_seconds). Neu khong goi -> BE khong biet user
  // da dang xuat -> session vinh vien o trang thai 'active'.
  const data = await httpClient.post('/auth/logout', {});
  return data;
}

export async function getMeApi() {
  const data = await httpClient.get('/auth/me');
  return data;
}

/**
 * Lay thoi gian server UTC (ISO8601).
 * FE dung de tinh clock offset (server - client), tranh hien thi sai khi
 * may client set gio sai.
 */
export async function getServerTime() {
  const data = await httpClient.get('/auth/server-time');
  return data; // { serverTime: '2026-07-19T11:25:14.613Z' }
}

/**
 * Heartbeat: cap nhat last_activity_at theo dinh ky (60s throttle phia BE).
 *
 * Tra ve:
 *   { updated, deviceId, serverTime } neu thanh cong
 *   { unauthorized: true } neu nhan 401/403 (FE xu ly rieng)
 *   null neu loi khac (network / 5xx)
 *
 * QUAN TRONG: heartbeat TU KHONG show SessionExpiredModal.
 * 401 vao day co the la do request STALE dang chay sau khi user logout/login moi.
 * Hook useHeartbeat da co logic backoff rieng, no se quyet dinh khi nao modal.
 */
export async function heartbeatApi() {
  try {
    const data = await httpClient.post(
      '/auth/heartbeat',
      {},
      { skipSessionExpired: true } // Hook xu ly 401 rieng, khong trigger modal
    );
    return data;
  } catch (err) {
    const status = err?.status;
    // 401/403 -> hook se quyet dinh co show modal hay khong (chi show 1 lan)
    if (status === 401 || status === 403) {
      return { unauthorized: true, status };
    }
    // Loi khac (network, 5xx) -> null
    if (typeof console !== 'undefined') {
      console.debug('[heartbeat] skipped:', err && err.message);
    }
    return null;
  }
}

/**
 * Refresh permissions: lay token moi + permissions moi tu DB (bo qua cache BE).
 *
 * Dung khi:
 *   - SSE nhan 'permission-changed' (admin vua doi matrix).
 *   - User navigate/F5 vao 1 trang co permission check (ProtectedRoute) - dam
 *     bao JWT trong storage dong bo voi DB.
 *   - Heartbeat dinh ky (toi da 1 lan / 60s) de bat ke thay doi permission
 *     ngoai SSE (VD: admin sua tu tab khac, user offline luc admin luu).
 *
 * Tra ve:
 *   { token, user } neu thanh cong
 */
export async function refreshPermissionsApi() {
  const data = await httpClient.post('/auth/refresh-permissions', {});
  return data;
}

export default {
  loginApi,
  logoutApi,
  getMeApi,
  getServerTime,
  heartbeatApi,
  refreshPermissionsApi,
  forgotPasswordApi,
  resetPasswordApi,
};
