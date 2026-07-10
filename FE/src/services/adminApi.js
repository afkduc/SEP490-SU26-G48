import httpClient from './httpClient';

/**
 * Legacy named exports (giu de backward compat voi code cu)
 */
export async function getAdminDashboardStats() {
  const res = await httpClient.get('/admin/dashboard');
  return res?.data;
}

export async function listAdminUsers() {
  const res = await httpClient.get('/admin/users');
  return res?.data;
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
 */
class AdminUsersApi {
  list(params = {}) {
    return httpClient.get(`/admin/users${buildQuery(params)}`);
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