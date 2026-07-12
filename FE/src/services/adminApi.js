import httpClient from './httpClient';

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
}

const adminUsersApi = new AdminUsersApi();

/**
 * Admin Branches API (dropdown filter)
 *   - list(): GET /api/admin/branches
 *     tra ve: { items: [{id, branchName}], total }
 */
class AdminBranchesApi {
  list() {
    return httpClient.get('/admin/branches');
  }
}

const adminBranchesApi = new AdminBranchesApi();

/**
 * Admin Roles API (UC-11 + UC-12)
 *   - list():         GET /api/admin/roles
 *     tra ve: { items: [{id, roleName, roleLabel, description, isActive, userCount}], total }
 *   - getDetail(id):  GET /api/admin/roles/:id
 *     tra ve: { id, roleName, roleLabel, description, isActive, userCount }
 */
class AdminRolesApi {
  list() {
    return httpClient.get('/admin/roles');
  }

  getDetail(id) {
    return httpClient.get(`/admin/roles/${id}`);
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