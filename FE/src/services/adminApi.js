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
 *     options: { mustChangePassword?: boolean, newPassword?: string }
 *       mustChangePassword: mac dinh true (co the client override qua body)
 *       newPassword:
 *         - undefined/empty -> BE sinh MK random 12 ky tu (hoa+thuong+so+dac biet)
 *         - co gia tri      -> BE validate (>=6 ky tu) va dung MK do
 *     tra ve: { userId, newPassword, isManual, mustChangePassword, message }
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

  resetPassword(userId, { mustChangePassword = true, newPassword } = {}) {
    const body = { mustChangePassword };
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
 * Admin Roles API (UC-11)
 *   - list():                    GET /api/admin/roles
 *   - getDetail(id):            GET /api/admin/roles/:id
 *   - create(payload):          POST /api/admin/roles
 *   - update(id, payload):      PUT /api/admin/roles/:id
 *   - toggleStatus(id):         PATCH /api/admin/roles/:id/toggle-status (soft delete only)
 *   - listWithPermissions():    GET /api/admin/roles/full  (1 call, tranh N+1)
 *   - listPermissions():         GET /api/admin/permissions
 *   - getRolePermissions(id):    GET /api/admin/roles/:id/permissions
 *   - setRolePermissions(id, permIds[]): PUT /api/admin/roles/:id/permissions
 *   - saveMatrix(changes[]):            PUT /api/admin/roles/matrix/permissions
 *   - getRoleUsers(id):         GET /api/admin/roles/:id/users
 *
 * Permission Groups (Phase 3):
 *   - listPermissionGroups():    GET /api/admin/permission-groups
 *   - getPermissionGroup(id):    GET /api/admin/permission-groups/:id
 *   - getRoleGroupIds(id):       GET /api/admin/roles/:id/groups
 *   - setRoleGroups(id, gids):   PUT /api/admin/roles/:id/groups
 *   - saveRoleGroupsMatrix(chs): PUT /api/admin/roles/groups/matrix
 *
 * LUU Y: KHONG co `delete()` - he thong chi dung soft delete (active/inactive).
 */
class AdminRolesApi {
  list() {
    return httpClient.get('/admin/roles');
  }

  listWithPermissions() {
    return httpClient.get('/admin/roles/full');
  }

  getDetail(id) {
    return httpClient.get(`/admin/roles/${id}`);
  }

  create(payload) {
    return httpClient.post('/admin/roles', payload);
  }

  update(id, payload) {
    return httpClient.put(`/admin/roles/${id}`, payload);
  }

  toggleStatus(id) {
    return httpClient.patch(`/admin/roles/${id}/toggle-status`);
  }

  listPermissions() {
    return httpClient.get('/admin/permissions');
  }

  getRolePermissions(id) {
    return httpClient.get(`/admin/roles/${id}/permissions`);
  }

  setRolePermissions(id, permissionIds) {
    return httpClient.put(`/admin/roles/${id}/permissions`, { permissionIds });
  }

  /**
   * Bulk save permissions cho nhieu role trong 1 call (atomic).
   * changes: [{roleId, permissionIds}, ...]
   */
  saveMatrix(changes) {
    return httpClient.put('/admin/roles/matrix/permissions', { changes });
  }

  getRoleUsers(id) {
    return httpClient.get(`/admin/roles/${id}/users`);
  }

  // ============================================================
  // PERMISSION GROUPS (Phase 3)
  // ============================================================

  /**
   * Lay tat ca nhom quyen (kem permissionKeys).
   * Tra ve: { items, byModule, total }
   */
  listPermissionGroups() {
    return httpClient.get('/admin/permission-groups');
  }

  /**
   * Lay chi tiet 1 nhom quyen (kem permissionKeys).
   */
  getPermissionGroup(id) {
    return httpClient.get(`/admin/permission-groups/${id}`);
  }

  /**
   * Lay groupIds da gan cho 1 role (suy ra tu role_permissions).
   * Tra ve: { roleId, groupIds }
   */
  getRoleGroupIds(id) {
    return httpClient.get(`/admin/roles/${id}/groups`);
  }

  /**
   * Gan danh sach groupIds cho 1 role.
   * groupIds: number[]
   */
  setRoleGroups(id, groupIds) {
    return httpClient.put(`/admin/roles/${id}/groups`, { groupIds });
  }

  /**
   * Bulk save groups cho nhieu role trong 1 call (atomic).
   * changes: [{ roleId, groupIds }, ...]
   */
  saveRoleGroupsMatrix(changes) {
    return httpClient.put('/admin/roles/groups/matrix', { changes });
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
 * Lay permissions moi nhat tu DB sau khi admin sua ma tran quyen.
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
 *   - list(params):     GET /api/admin/devices
 *   - listByUser(id): GET /api/admin/devices/user/:id
 *   - forceLogout(deviceId): DELETE /api/admin/devices/:deviceId
 *   - forceLogoutOthers(userId, currentDeviceId): DELETE /api/admin/devices/user/:userId/others
 */
class AdminDevicesApi {
  list(params = {}) {
    return httpClient.get(`/admin/devices${buildQuery(params)}`);
  }

  listByUser(userId) {
    return httpClient.get(`/admin/devices/user/${userId}`);
  }

  forceLogout(deviceId) {
    return httpClient.delete(`/admin/devices/${deviceId}`);
  }

  forceLogoutOthers(userId, currentDeviceId) {
    return httpClient.delete(`/admin/devices/user/${userId}/others?currentDeviceId=${currentDeviceId || ''}`);
  }

  /**
   * Admin force logout ALL devices of a user (including current).
   * DELETE /api/admin/devices/user/:userId/all
   */
  forceLogoutAllDevices(userId) {
    return httpClient.delete(`/admin/devices/user/${userId}/all`);
  }
}

const adminDevicesApi = new AdminDevicesApi();

export { AdminDevicesApi, adminDevicesApi };

/**
 * Admin Specialties API
 *   - list():              GET /api/admin/specialties
 *   - create(payload):    POST /api/admin/specialties
 *   - update(id, payload): PUT /api/admin/specialties/:id
 *   - toggleStatus(id):   PATCH /api/admin/specialties/:id/toggle-status (soft delete only)
 *   - getUserSpecialties(userId): GET /api/admin/users/:userId/specialties
 *   - setUserSpecialties(userId, ids[]): PUT /api/admin/users/:userId/specialties
 *
 * LUU Y: KHONG co `delete()` - he thong chi dung soft delete (active/inactive).
 */
class AdminSpecialtiesApi {
  list() {
    return httpClient.get('/admin/specialties');
  }

  create(payload) {
    return httpClient.post('/admin/specialties', payload);
  }

  update(id, payload) {
    return httpClient.put(`/admin/specialties/${id}`, payload);
  }

  toggleStatus(id) {
    return httpClient.patch(`/admin/specialties/${id}/toggle-status`);
  }

  getUserSpecialties(userId) {
    return httpClient.get(`/admin/users/${userId}/specialties`);
  }

  setUserSpecialties(userId, specialtyIds) {
    return httpClient.put(`/admin/users/${userId}/specialties`, { specialtyIds });
  }
}

const adminSpecialtiesApi = new AdminSpecialtiesApi();

export { AdminSpecialtiesApi, adminSpecialtiesApi };

/**
 * Admin Security Alerts API
 *   - list(params):   GET /api/admin/security-alerts
 *   - getCounts():    GET /api/admin/security-alerts/counts
 *   - ack(id):        PATCH /api/admin/security-alerts/:id/ack
 */
class AdminSecurityAlertsApi {
  list(params = {}) {
    return httpClient.get(`/admin/security-alerts${buildQuery(params)}`);
  }

  getCounts() {
    return httpClient.get('/admin/security-alerts/counts');
  }

  ack(alertId) {
    return httpClient.patch(`/admin/security-alerts/${alertId}/ack`);
  }
}

const adminSecurityAlertsApi = new AdminSecurityAlertsApi();

export { AdminSecurityAlertsApi, adminSecurityAlertsApi };

/**
 * Permission Matrix API (admin-only)
 *   - getMatrix():      GET   /api/admin/permission-matrix
 *                       tra ve: { roles: [...], screens: [...], grants: [{roleId,permissionId}], generatedAt }
 *   - toggleCell(payload): PATCH /api/admin/permission-matrix
 *                       payload: { roleId, permissionId, granted: boolean }
 *   - bulkToggle(payload): POST  /api/admin/permission-matrix/bulk
 *                       payload: { cells: [{roleId, permissionId, granted}, ...] }
 */
class PermissionMatrixApi {
  getMatrix() {
    return httpClient.get('/admin/permission-matrix');
  }

  toggleCell({ roleId, permissionId, granted }) {
    return httpClient.patch('/admin/permission-matrix', { roleId, permissionId, granted });
  }

  bulkToggle(cells) {
    return httpClient.post('/admin/permission-matrix/bulk', { cells });
  }
}

const permissionMatrixApi = new PermissionMatrixApi();

export { PermissionMatrixApi, permissionMatrixApi };

/**
 * Role Screen Matrix API (admin-only) - granular action-per-screen.
 *   - getAvailableScreens(): GET   /api/admin/role-screen-matrix/screens
 *   - getMatrix(roleId):     GET   /api/admin/role-screen-matrix?roleId=1
 *   - saveMatrix(roleId, items): PUT /api/admin/role-screen-matrix?roleId=1
 *       items: [{ screenKey, canView, canCreate, canUpdate, canDelete, canExport }]
 *   - compareMatrix(roleIds): GET  /api/admin/role-screen-matrix/compare?roleIds=1,2,3
 */
class RoleScreenMatrixApi {
  getAvailableScreens() {
    return httpClient.get('/admin/role-screen-matrix/screens');
  }

  getMatrix(roleId) {
    return httpClient.get(`/admin/role-screen-matrix?roleId=${roleId}`);
  }

  saveMatrix(roleId, items) {
    return httpClient.put(`/admin/role-screen-matrix?roleId=${roleId}`, { items });
  }

  compareMatrix(roleIds) {
    return httpClient.get(`/admin/role-screen-matrix/compare?roleIds=${roleIds.join(',')}`);
  }
}

const roleScreenMatrixApi = new RoleScreenMatrixApi();

export { RoleScreenMatrixApi, roleScreenMatrixApi };

/**
 * User Screen Permissions API (admin-only) - override quyen cho 1 user cu the.
 *   - getPermissions(userId):     GET   /api/admin/users/:userId/screen-permissions
 *   - savePermissions(userId, items): PUT /api/admin/users/:userId/screen-permissions
 *       items: [{ screenKey, canView, canCreate, canUpdate, canDelete, canExport, overrideType, note }]
 *   - clearPermissions(userId):   DELETE /api/admin/users/:userId/screen-permissions
 *   - getEffective(userId):       GET   /api/admin/users/:userId/screen-permissions/effective
 */
class UserScreenPermissionsApi {
  getPermissions(userId) {
    return httpClient.get(`/admin/users/${userId}/screen-permissions`);
  }

  savePermissions(userId, items) {
    return httpClient.put(`/admin/users/${userId}/screen-permissions`, { items });
  }

  clearPermissions(userId) {
    return httpClient.delete(`/admin/users/${userId}/screen-permissions`);
  }

  getEffective(userId) {
    return httpClient.get(`/admin/users/${userId}/screen-permissions/effective`);
  }
}

const userScreenPermissionsApi = new UserScreenPermissionsApi();

export { UserScreenPermissionsApi, userScreenPermissionsApi };
