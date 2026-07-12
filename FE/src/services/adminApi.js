import httpClient from './httpClient';

/**
 * Legacy named exports (giu de backward compat voi code cu)
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
 * Admin Roles API (dropdown filter)
 *   - list(): GET /api/admin/roles
 *     tra ve: { items: [{id, roleName}], total }
 *   - Note: Roles cung duoc dung chung cho UC-11 (phan quyen user)
 */
class AdminRolesApi {
  list() {
    return httpClient.get('/admin/roles');
  }
}

const adminRolesApi = new AdminRolesApi();

export {
  AdminUsersApi,
  AdminBranchesApi,
  AdminRolesApi,
  adminUsersApi,
  adminBranchesApi,
  adminRolesApi,
};