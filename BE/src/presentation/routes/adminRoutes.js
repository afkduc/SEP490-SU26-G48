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

/**
 * Admin routes — role admin only.
 * Kept: users, branches, list roles (for assign), assign/revoke, devices (single logout),
 * security alerts, login-sessions recent.
 * Removed: role CRUD / permission matrix (UI + BE service/repo matrix APIs).
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
  router.get('/users/export', validateListUsersQuery, controller.exportUsers);
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

  // Roles: list only (dropdown for assign). No role CRUD / permission matrix.
  router.get('/roles', controller.listRoles);
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
  router.post(
    '/devices/:deviceId/logout',
    validateIdParam('deviceId'),
    controller.forceLogoutDevice
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
