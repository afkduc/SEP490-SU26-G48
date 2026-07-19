import httpClient from './httpClient';

export async function loginApi(email, password) {
  const data = await httpClient.post(
    '/auth/login',
    { email, password },
    { omitAuth: true, skipSessionExpired: true }
  );
  return data; // { token, user }
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
 * Tra ve { updated, deviceId, serverTime }.
 * Loi (401, network) -> nuot, khong anh huong UI.
 */
export async function heartbeatApi() {
  try {
    const data = await httpClient.post('/auth/heartbeat', {});
    return data;
  } catch (err) {
    // Request cu dang chay se khong bat modal neu token da duoc thay moi;
    // 401 cua chinh token hien tai van thong bao het phien binh thuong.
    if (typeof console !== 'undefined') console.debug('[heartbeat] skipped:', err && err.message);
    return null;
  }
}
