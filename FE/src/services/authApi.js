import httpClient from './httpClient';

export async function loginApi(identifier, password, branchId, { force = false, pendingId = null } = {}) {
  const data = await httpClient.post(
    '/auth/login',
    {
      identifier,
      email: identifier,
      password,
      branchId,
      force: Boolean(force),
      ...(pendingId ? { pendingId } : {}),
    },
    { omitAuth: true, skipSessionExpired: true }
  );
  return data;
}

export async function getPendingLoginApi(pendingId) {
  return httpClient.get(`/auth/login/pending/${pendingId}`, {
    omitAuth: true,
    skipSessionExpired: true,
  });
}

export async function approvePendingLoginApi(pendingId) {
  return httpClient.post(`/auth/login/pending/${pendingId}/approve`, {});
}

export async function rejectPendingLoginApi(pendingId) {
  return httpClient.post(`/auth/login/pending/${pendingId}/reject`, {});
}

/** Phiên đang online: danh sách yêu cầu login chờ xác nhận. */
export async function getMyLoginChallengesApi() {
  return httpClient.get('/auth/login/challenges');
}

/** Mở modal cảnh báo lớn khi có LOGIN_CHALLENGE. */
export function dispatchLoginChallenge(detail) {
  if (typeof window === 'undefined' || !detail?.pendingId) return;
  window.dispatchEvent(new CustomEvent('login-challenge', { detail }));
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
  const data = await httpClient.post('/auth/logout', {});
  return data;
}

export async function getMeApi() {
  const data = await httpClient.get('/auth/me');
  return data;
}

export async function getServerTime() {
  const data = await httpClient.get('/auth/server-time');
  return data;
}

export async function heartbeatApi() {
  try {
    const data = await httpClient.post(
      '/auth/heartbeat',
      {},
      { skipSessionExpired: true }
    );
    return data;
  } catch (err) {
    const status = err?.status;
    if (status === 401 || status === 403) {
      return { unauthorized: true, status };
    }
    if (typeof console !== 'undefined') {
      console.debug('[heartbeat] skipped:', err && err.message);
    }
    return null;
  }
}

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
  getPendingLoginApi,
  approvePendingLoginApi,
  rejectPendingLoginApi,
};
