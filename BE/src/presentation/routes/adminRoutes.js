const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const { validateIdParam } = require('../validators/commonValidators');
const {
  validateListUsersQuery,
  validateCreateUser,
  validateUpdateUser,
  validateResetPassword,
  validateAssignRoles,
} = require('../validators/adminUserValidator');
const { validateCreateBranch, validateUpdateBranch } = require('../validators/adminBranchValidator');
const {
  validateCreateRole,
  validateUpdateRole,
  validateSetPermissions,
} = require('../validators/adminRoleValidator');

/**
 * Admin routes — chỉ cần role admin (đã gỡ ma trận quyền screen:*).
 * Input validation: Presentation middleware → business rules: Service.
 */
function buildAdminRouter() {
  const router = express.Router();
  const controller = new AdminController();

  router.post('/reissue-token', authenticate, trackActivity, controller.reissueToken);
  router.get('/debug-permissions', authenticate, controller.debugPermissions);
  router.post('/refresh-permissions', authenticate, trackActivity, controller.refreshPermissions);

  router.use(authenticate, requireAdmin, trackActivity);

  router.get('/dashboard', controller.getDashboardStats);

  router.get('/users', validateListUsersQuery, controller.listUsers);
  router.get('/users/export', controller.exportUsers);
  router.get('/users/:id', validateIdParam('id'), controller.getUserDetail);
  router.post('/users', validateCreateUser, controller.createUser);
  router.put('/users/:id', validateIdParam('id'), validateUpdateUser, controller.updateUser);
  router.post(
    '/users/:id/reset-password',
    validateIdParam('id'),
    validateResetPassword,
    controller.resetPassword
  );

  router.get('/branches', controller.listBranches);
  router.get('/branches/full', controller.listBranchesFull);
  router.get('/branches/manager-candidates', controller.getManagerCandidates);
  router.get('/branches/:id', validateIdParam('id'), controller.getBranchDetail);
  router.get('/branches/:id/stats', validateIdParam('id'), controller.getBranchStats);
  router.post('/branches', validateCreateBranch, controller.createBranch);
  router.put('/branches/:id', validateIdParam('id'), validateUpdateBranch, controller.updateBranch);
  router.patch('/branches/:id/deactivate', validateIdParam('id'), controller.deactivateBranch);
  router.patch('/branches/:id/reactivate', validateIdParam('id'), controller.reactivateBranch);

  router.get('/roles', controller.listRoles);
  router.get('/roles/full', controller.listRolesWithPermissions);
  router.get('/roles/:id', validateIdParam('id'), controller.getRoleDetail);
  router.post('/roles', validateCreateRole, controller.createRole);
  router.put('/roles/:id', validateIdParam('id'), validateUpdateRole, controller.updateRole);
  router.patch('/roles/:id/toggle-status', validateIdParam('id'), controller.toggleRoleStatus);
  router.get('/permissions', controller.listPermissions);
  router.get('/roles/:id/permissions', validateIdParam('id'), controller.getRolePermissions);
  router.put(
    '/roles/:id/permissions',
    validateIdParam('id'),
    validateSetPermissions,
    controller.setRolePermissions
  );
  router.get('/roles/:id/users', validateIdParam('id'), controller.getRoleUsers);

  router.get('/users/:userId/roles', validateIdParam('userId'), controller.getUserRoles);
  router.post(
    '/users/:userId/roles',
    validateIdParam('userId'),
    validateAssignRoles,
    controller.assignRoles
  );
  router.delete(
    '/users/:userId/roles/:roleId',
    validateIdParam('userId'),
    validateIdParam('roleId'),
    controller.revokeRole
  );

  router.get('/devices', controller.listDevices);
  router.get('/devices/user/:userId', validateIdParam('userId'), controller.listUserDevices);
  router.patch('/devices/:deviceId/trust', validateIdParam('deviceId'), controller.setDeviceTrusted);
  // POST …/logout — đăng xuất phiên thiết bị (tránh DELETE gây hiểu nhầm “xóa”)
  router.post(
    '/devices/:deviceId/logout',
    validateIdParam('deviceId'),
    controller.forceLogoutDevice
  );
  router.post(
    '/devices/user/:userId/others/logout',
    validateIdParam('userId'),
    controller.forceLogoutAllOtherDevices
  );
  router.post(
    '/devices/user/:userId/all/logout',
    validateIdParam('userId'),
    controller.forceLogoutAllDevices
  );

  router.get('/security-alerts', controller.listSecurityAlerts);
  router.get('/security-alerts/counts', controller.acknowledgeAlertCounts);
  router.patch('/security-alerts/ack-all', controller.acknowledgeAllAlerts);
  router.patch(
    '/security-alerts/:id/ack',
    validateIdParam('id'),
    controller.acknowledgeAlert
  );

  router.post('/sessions/cleanup', controller.cleanupDuplicateSessions);
  router.get('/login-sessions/recent', controller.getRecentLoginSessions);

  return router;
}

module.exports = buildAdminRouter;
