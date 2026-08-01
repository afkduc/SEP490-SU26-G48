import httpClient from './httpClient';
import { API_BASE_URL } from '../config';
import { fetchBlob } from '../utils/downloadBlob';

/**
 * Legacy named exports (giu de backward compat voi code cu)
 *
 * httpClient.get() da unwrap boi wrapper { success, message, data },
 * tra ve thang phan data (object). Nen KHONG goi them .data o day.
 * Tuong tu cho listAdminUsers.
 */
export async function getAdminDashboardStats() {
  return httpClient.get('/admin/dashboard');
}

export async function listAdminUsers() {
  return httpClient.get('/admin/users');
}

/**
 * Build query string tu object, bo qua gia tri null/undefined/empty
 */
function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Admin Users API
 *   - list(params): GET /api/admin/users voi filter + paging
 *     params: { search, branchId, roleId, status, page, pageSize }
 *     tra ve: { items: [{id, name, email, fullName, phone, branchId, branchName, status, roles, ...}], total, page, pageSize }
 *
 *   - getDetail(id): GET /api/admin/users/:id
 *     tra ve: { id, name, email, fullName, phone, branchId, branchName, status, roles, ... }
 *
 *   - create(payload): POST /api/admin/users
 *     payload: { name, email, password, fullName, phone, branchId, roleId }
 *     tra ve: { id, email }
 *
 *   - update(payload): PUT /api/admin/users/:id
 *     payload: { userId, status, roleId }
 *     tra ve: { id, name, email, fullName, phone, branchId, branchName, status, roles, ... }
 *
 *   - resetPassword(userId, options): POST /api/admin/users/:id/reset-password
 *     options: { newPassword?: string }
 *       newPassword:
 *         - undefined/empty -> BE sinh MK random 12 ky tu (hoa+thuong+so+dac biet)
 *         - co gia tri      -> BE validate (>=6 ky tu) va dung MK do
 *     tra ve: { userId, newPassword, isManual, message }
 */
class AdminUsersApi {
  list(params = {}) {
    return httpClient.get(`/admin/users${buildQuery(params)}`);
  }

  getDetail(id) {
    return httpClient.get(`/admin/users/${id}`);
  }

  create(payload) {
    return httpClient.post('/admin/users', payload);
  }

  update(payload) {
    return httpClient.put(`/admin/users/${payload.userId}`, payload);
  }

  resetPassword(userId, { newPassword } = {}) {
    const body = {};
    if (newPassword !== undefined && newPassword !== null && newPassword !== '') {
      body.newPassword = newPassword;
    }
    return httpClient.post(`/admin/users/${userId}/reset-password`, body);
  }

  /**
   * Xuat danh sach nguoi dung ra file Excel (.xlsx) theo filter hien tai.
   * Tra ve Blob (tuong thich voi downloadBlob utility).
   * BE se set Content-Disposition de lay ten file users_YYYYMMDD.xlsx.
   */
  exportUsers(params = {}) {
    const path = `${API_BASE_URL}/admin/users/export${buildQuery(params)}`;
    return fetchBlob(path);
  }
}

const adminUsersApi = new AdminUsersApi();

/**
 * Admin Branches API
 *   - list():           GET /api/admin/branches (dropdown - chi tra ve id + branchName)
 *   - listFull():      GET /api/admin/branches/full (admin page - tra ve thong tin day du)
 *   - getDetail(id):   GET /api/admin/branches/:id
 *   - getStats(id):    GET /api/admin/branches/:id/stats
 *   - getManagerCandidates(): GET /api/admin/branches/manager-candidates
 *   - create(payload):  POST /api/admin/branches
 *   - update(id, payload): PUT /api/admin/branches/:id
 *   - deactivate(id):  PATCH /api/admin/branches/:id/deactivate
 *   - reactivate(id): PATCH /api/admin/branches/:id/reactivate
 */
class AdminBranchesApi {
  list() {
    return httpClient.get('/admin/branches');
  }

  listFull() {
    return httpClient.get('/admin/branches/full');
  }

  getDetail(id) {
    return httpClient.get(`/admin/branches/${id}`);
  }

  getStats(id) {
    return httpClient.get(`/admin/branches/${id}/stats`);
  }

  getManagerCandidates() {
    return httpClient.get('/admin/branches/manager-candidates');
  }

  create(payload) {
    return httpClient.post('/admin/branches', payload);
  }

  update(id, payload) {
    return httpClient.put(`/admin/branches/${id}`, payload);
  }

  deactivate(id) {
    return httpClient.patch(`/admin/branches/${id}/deactivate`);
  }

  reactivate(id) {
    return httpClient.patch(`/admin/branches/${id}/reactivate`);
  }
}

const adminBranchesApi = new AdminBranchesApi();

/**
 * Admin Roles API — danh sách role để gán trên form user (không còn màn CRUD vai trò).
 *   - list(): GET /api/admin/roles
 */
class AdminRolesApi {
  list() {
    return httpClient.get('/admin/roles');
  }
}

const adminRolesApi = new AdminRolesApi();

/**
 * Admin User Roles API (UC-12)
 *   - getUserRoles(userId):   GET /api/admin/users/:userId/roles
 *     tra ve: [{id, roleId, roleName, roleLabel}]
 *   - assignRoles(payload):    POST /api/admin/users/:userId/roles
 *     payload: { userId, roleIds: number[] }
 *     tra ve: [{id, roleId, roleName, roleLabel}]
 *   - revokeRole(userId, roleId): DELETE /api/admin/users/:userId/roles/:roleId
 *     tra ve: [{id, roleId, roleName, roleLabel}]
 */
class AdminUserRolesApi {
  getUserRoles(userId) {
    return httpClient.get(`/admin/users/${userId}/roles`);
  }

  assignRoles(userId, roleIds) {
    return httpClient.post(`/admin/users/${userId}/roles`, { roleIds });
  }

  revokeRole(userId, roleId) {
    return httpClient.delete(`/admin/users/${userId}/roles/${roleId}`);
  }
}

const adminUserRolesApi = new AdminUserRolesApi();

/**
 * Admin Login Sessions API
 *   - list(params): GET /api/audit/login-sessions
 *     params: { userName, phone, actionType, status, startDate, endDate, branchId, page, pageSize }
 *     tra ve: { items, total, page, pageSize }
 *   - getRecent(): GET /api/audit/login-sessions?page=1&pageSize=8
 */
class AdminLoginSessionsApi {
  list(params = {}) {
    return httpClient.get(`/audit/login-sessions${buildQuery(params)}`);
  }
  // Realtime polling - lay cac session moi tu moc since (ISO date hoac unix ms)
  recent(since) {
    const sinceMs = typeof since === 'number' ? new Date(since).toISOString() : since;
    return httpClient.get(`/admin/login-sessions/recent?since=${encodeURIComponent(sinceMs || '')}&limit=50`);
  }
}

const adminLoginSessionsApi = new AdminLoginSessionsApi();

export async function getRecentLoginSessions() {
  const res = await httpClient.get('/audit/login-sessions?page=1&pageSize=8');
  return res;
}

/**
 * POST /api/admin/reissue-token
 * Cap lai JWT voi day du roles tu DB. Dung khi token cu thieu role admin
 * (vi du: user moi duoc them role admin nhung token cu van con cache).
 * Tra ve: { token, roles }
 */
export async function reissueAdminToken() {
  return httpClient.post('/admin/reissue-token', {});
}

/**
 * POST /api/admin/refresh-permissions
 * Lay permissions moi nhat tu DB.
 * Tra ve: { token, permissions }
 */
export async function refreshPermissionsApi() {
  return httpClient.post('/admin/refresh-permissions', {});
}

export {
  AdminUsersApi,
  AdminBranchesApi,
  AdminRolesApi,
  AdminUserRolesApi,
  adminUsersApi,
  adminBranchesApi,
  adminRolesApi,
  adminUserRolesApi,
  adminLoginSessionsApi,
};

/**
 * Admin Devices API
 *   - list(params): GET /api/admin/devices
 *   - listByUser(id): GET /api/admin/devices/user/:id
 *   - forceLogout(deviceId): POST /api/admin/devices/:deviceId/logout
 */
class AdminDevicesApi {
  list(params = {}) {
    return httpClient.get(`/admin/devices${buildQuery(params)}`);
  }

  listByUser(userId) {
    return httpClient.get(`/admin/devices/user/${userId}`);
  }

  forceLogout(deviceId) {
    return httpClient.post(`/admin/devices/${deviceId}/logout`);
  }
}

const adminDevicesApi = new AdminDevicesApi();

export { AdminDevicesApi, adminDevicesApi };

/**
 * Admin Security Alerts API
 *   - list(params):   GET /api/admin/security-alerts
 *   - getCounts():    GET /api/admin/security-alerts/counts
 *   - ack(id):        PATCH /api/admin/security-alerts/:id/ack
 *   - ackAll():       PATCH /api/admin/security-alerts/ack-all
 */
class AdminSecurityAlertsApi {
  list(params = {}) {
    return httpClient.get(`/admin/security-alerts${buildQuery(params)}`);
  }

  /** Lịch sử đầy đủ cùng nhóm rule+user (cho popup chi tiết) */
  related({ ruleKey, userId, pageSize = 50 } = {}) {
    return httpClient.get(`/admin/security-alerts${buildQuery({
      related: '1',
      ruleKey,
      userId: userId ?? '',
      pageSize,
    })}`);
  }

  getCounts() {
    return httpClient.get('/admin/security-alerts/counts');
  }

  ack(alertId) {
    return httpClient.patch(`/admin/security-alerts/${alertId}/ack`);
  }

  ackAll() {
    return httpClient.patch('/admin/security-alerts/ack-all');
  }
}

const adminSecurityAlertsApi = new AdminSecurityAlertsApi();

export { AdminSecurityAlertsApi, adminSecurityAlertsApi };
