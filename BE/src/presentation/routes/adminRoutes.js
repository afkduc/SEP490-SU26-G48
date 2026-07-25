const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { requirePerm, requireScreen } = require('../../middlewares/permission');
const { trackActivity } = require('../../middlewares');
const { validateListUsersQuery } = require('../validators/adminUserValidator');
const buildPermissionMatrixRouter = require('./permissionMatrixRoutes');

/**
 * Admin routes - chi danh cho user co role admin
 *
 * POST /api/admin/reissue-token       -- cap lai JWT voi day du roles tu DB
 * GET  /api/admin/dashboard
 * GET  /api/admin/users
 * GET  /api/admin/users/:id
 * POST /api/admin/users
 * PUT  /api/admin/users/:id
 * POST /api/admin/users/:id/reset-password  -- Admin reset MK cho user
 * GET  /api/admin/branches
 * GET  /api/admin/roles              -- UC-11: list all roles
 * GET  /api/admin/roles/:id         -- UC-11: role detail
 * GET  /api/admin/users/:userId/roles       -- UC-12: roles of user
 * POST /api/admin/users/:userId/roles       -- UC-12: assign role(s) to user
 * DEL  /api/admin/users/:userId/roles/:roleId -- UC-12: revoke 1 role
 */
function buildAdminRouter() {
  const router = express.Router();
  const controller = new AdminController();

  // Endpoint reissue-token dat TRUOC requireAdmin de user co token cu (thieu role admin)
  // van co the goi va lay token moi co day du roles tu DB.
  router.post('/reissue-token', authenticate, trackActivity, controller.reissueToken);

  // Debug: xem permissions hien tai cua user (tu JWT, KHONG query DB moi)
  router.get('/debug-permissions', authenticate, controller.debugPermissions);

  // Refresh permissions sau khi admin sua ma tran quyen
  router.post('/refresh-permissions', authenticate, trackActivity, controller.refreshPermissions);

  // Permission matrix (Role x Screen) - admin-only.
  // Mount sub-router voi requireAdmin rieng de tranh conflict voi /reissue-token.
  router.use('/permission-matrix', authenticate, requireAdmin, requireScreen('permission_matrix'), trackActivity, buildPermissionMatrixRouter());

  router.use(authenticate, requireAdmin, requireScreen('dashboard'), trackActivity);

  router.get('/dashboard', controller.getDashboardStats);

  // Users - enforce granular permissions theo RBAC matrix
  router.use('/users', requireScreen('users'));
  router.get('/users', requirePerm('admin:users:read'), validateListUsersQuery, controller.listUsers);
  router.get('/users/export', requirePerm('admin:users:read'), controller.exportUsers);
  router.get('/users/:id', requirePerm('admin:users:read'), controller.getUserDetail);
  router.post('/users', requirePerm('admin:users:create'), controller.createUser);
  router.put('/users/:id', requirePerm('admin:users:update'), controller.updateUser);
  router.post('/users/:id/reset-password', requirePerm('admin:users:update'), controller.resetPassword);

  // Branches - granular permissions
  router.use('/branches', requireScreen('branches'));
  router.get('/branches', requirePerm('admin:branches:read'), controller.listBranches);
  router.get('/branches/full', requirePerm('admin:branches:read'), controller.listBranchesFull);
  router.get('/branches/manager-candidates', requirePerm('admin:branches:read'), controller.getManagerCandidates);
  router.get('/branches/:id', requirePerm('admin:branches:read'), controller.getBranchDetail);
  router.get('/branches/:id/stats', requirePerm('admin:branches:read'), controller.getBranchStats);
  router.post('/branches', requirePerm('admin:branches:create'), controller.createBranch);
  router.put('/branches/:id', requirePerm('admin:branches:update'), controller.updateBranch);
  router.patch('/branches/:id/deactivate', requirePerm('admin:branches:deactivate'), controller.deactivateBranch);
  router.patch('/branches/:id/reactivate', requirePerm('admin:branches:activate'), controller.reactivateBranch);

  // Roles (UC-11) - enforce granular permissions doc theo RBAC thuc te
  router.use('/roles', requireScreen('roles'));
  router.get('/roles', requirePerm('admin:roles:read'), controller.listRoles);
  // Route 'full' phai dat TRUOC /roles/:id de tranh match nhầm
  router.get('/roles/full', requirePerm('admin:roles:read'), controller.listRolesWithPermissions);
  router.get('/roles/:id', requirePerm('admin:roles:read'), controller.getRoleDetail);
  router.post('/roles', requirePerm('admin:roles:create'), controller.createRole);
  // Matrix route phai dat TRUOC /roles/:id de tranh Express match 'matrix' lam :id
  router.put('/roles/matrix/permissions', requirePerm('admin:roles:manage'), controller.saveRolePermissionsMatrix);
  router.put('/roles/:id', requirePerm('admin:roles:update'), controller.updateRole);
  // Soft delete: chi co toggle active/inactive, KHONG co DELETE cung.
  router.patch('/roles/:id/toggle-status', requirePerm('admin:roles:manage'), controller.toggleRoleStatus);
  router.get('/permissions', requirePerm('admin:roles:read'), controller.listPermissions);
  router.get('/roles/:id/permissions', requirePerm('admin:roles:read'), controller.getRolePermissions);
  router.put('/roles/:id/permissions', requirePerm('admin:roles:manage'), controller.setRolePermissions);
  router.get('/roles/:id/users', requirePerm('admin:roles:read'), controller.getRoleUsers);

  // Permission Groups (Phase 3) - hien thi ma tran quyen dang GROUP
  // /permission-groups/:id phai dat TRUOC /roles/:id/groups (route dai hon) cho de doc
  router.use('/permission-groups', requireScreen('roles'));
  router.get('/permission-groups', requirePerm('admin:roles:read'), controller.listPermissionGroups);
  router.get('/permission-groups/:id', requirePerm('admin:roles:read'), controller.getPermissionGroupDetail);
  router.get('/roles/:id/groups', requirePerm('admin:roles:read'), controller.getRoleGroupIds);
  router.put('/roles/:id/groups', requirePerm('admin:roles:manage'), controller.setRoleGroups);
  // Matrix bulk-assign: phai dat TRUOC /roles/:id de tranh Express match 'groups/matrix' lam :id
  router.put('/roles/groups/matrix', requirePerm('admin:roles:manage'), controller.setRoleGroupsMatrix);

  // User roles (UC-12) - gan/thu hoi role cho user
  router.get('/users/:userId/roles', requirePerm('admin:user_roles:read'), controller.getUserRoles);
  router.post('/users/:userId/roles', requirePerm('admin:user_roles:assign'), controller.assignRoles);
  router.delete('/users/:userId/roles/:roleId', requirePerm('admin:user_roles:revoke'), controller.revokeRole);

  // Devices (UC: quan ly thiet bi) - granular permissions
  // Khong check route nao khong co requirePerm vi neu admin role bi revoke
  // devices permissions van bi chan. Day la diem khac biet giua
  // role-check va permission-check (production-grade).
  router.use('/devices', requireScreen('devices'));
  router.get('/devices', requirePerm('admin:devices:read'), controller.listDevices);
  router.get('/devices/user/:userId', requirePerm('admin:devices:read'), controller.listUserDevices);
  router.delete('/devices/:deviceId', requirePerm('admin:devices:deactivate'), controller.forceLogoutDevice);
  router.delete('/devices/user/:userId/others', requirePerm('admin:devices:deactivate'), controller.forceLogoutAllOtherDevices);
  router.delete('/devices/user/:userId/all', requirePerm('admin:devices:deactivate'), controller.forceLogoutAllDevices);

  // Specialties - granular permissions
  router.use('/specialties', requireScreen('specialties'));
  router.get('/specialties', requirePerm('admin:specialties:read'), controller.listSpecialties);
  router.post('/specialties', requirePerm('admin:specialties:create'), controller.createSpecialty);
  router.put('/specialties/:id', requirePerm('admin:specialties:update'), controller.updateSpecialty);
  // Soft delete: chi co toggle active/inactive, KHONG co DELETE cung.
  router.patch('/specialties/:id/toggle-status', requirePerm('admin:specialties:manage'), controller.toggleSpecialtyStatus);
  router.get('/users/:userId/specialties', requirePerm('admin:specialties:read'), controller.getUserSpecialties);
  router.put('/users/:userId/specialties', requirePerm('admin:specialties:manage'), controller.setUserSpecialties);

  // Security Alerts - granular permissions
  router.use('/security-alerts', requireScreen('security_alerts'));
  router.get('/security-alerts', requirePerm('admin:security_alerts:read'), controller.listSecurityAlerts);
  router.get('/security-alerts/counts', requirePerm('admin:security_alerts:read'), controller.acknowledgeAlertCounts);
  router.patch('/security-alerts/:id/ack', requirePerm('admin:security_alerts:update'), controller.acknowledgeAlert);

  // Login sessions (UC: lich su dang nhap)
  router.use('/login-sessions', requireScreen('login_sessions'));
  router.post('/sessions/cleanup', requirePerm('admin:login_sessions:manage'), controller.cleanupDuplicateSessions);
  router.get('/login-sessions/recent', requirePerm('admin:login_sessions:read'), controller.getRecentLoginSessions);

  return router;
}

module.exports = buildAdminRouter;
