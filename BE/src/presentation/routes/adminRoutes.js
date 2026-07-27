const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const { validateListUsersQuery } = require('../validators/adminUserValidator');

/**
 * Admin routes — chỉ cần role admin (đã gỡ ma trận quyền screen:*).
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
  router.get('/users/:id', controller.getUserDetail);
  router.post('/users', controller.createUser);
  router.put('/users/:id', controller.updateUser);
  router.post('/users/:id/reset-password', controller.resetPassword);

  router.get('/branches', controller.listBranches);
  router.get('/branches/full', controller.listBranchesFull);
  router.get('/branches/manager-candidates', controller.getManagerCandidates);
  router.get('/branches/:id', controller.getBranchDetail);
  router.get('/branches/:id/stats', controller.getBranchStats);
  router.post('/branches', controller.createBranch);
  router.put('/branches/:id', controller.updateBranch);
  router.patch('/branches/:id/deactivate', controller.deactivateBranch);
  router.patch('/branches/:id/reactivate', controller.reactivateBranch);

  router.get('/roles', controller.listRoles);
  router.get('/roles/full', controller.listRolesWithPermissions);
  router.get('/roles/:id', controller.getRoleDetail);
  router.post('/roles', controller.createRole);
  router.put('/roles/:id', controller.updateRole);
  router.patch('/roles/:id/toggle-status', controller.toggleRoleStatus);
  router.get('/permissions', controller.listPermissions);
  router.get('/roles/:id/permissions', controller.getRolePermissions);
  router.put('/roles/:id/permissions', controller.setRolePermissions);
  router.get('/roles/:id/users', controller.getRoleUsers);

  router.get('/users/:userId/roles', controller.getUserRoles);
  router.post('/users/:userId/roles', controller.assignRoles);
  router.delete('/users/:userId/roles/:roleId', controller.revokeRole);

  router.get('/devices', controller.listDevices);
  router.get('/devices/user/:userId', controller.listUserDevices);
  router.delete('/devices/:deviceId', controller.forceLogoutDevice);
  router.delete('/devices/user/:userId/others', controller.forceLogoutAllOtherDevices);
  router.delete('/devices/user/:userId/all', controller.forceLogoutAllDevices);

  router.get('/specialties', controller.listSpecialties);
  router.post('/specialties', controller.createSpecialty);
  router.put('/specialties/:id', controller.updateSpecialty);
  router.patch('/specialties/:id/toggle-status', controller.toggleSpecialtyStatus);
  router.get('/users/:userId/specialties', controller.getUserSpecialties);
  router.put('/users/:userId/specialties', controller.setUserSpecialties);

  router.get('/security-alerts', controller.listSecurityAlerts);
  router.get('/security-alerts/counts', controller.acknowledgeAlertCounts);
  router.patch('/security-alerts/ack-all', controller.acknowledgeAllAlerts);
  router.patch('/security-alerts/:id/ack', controller.acknowledgeAlert);

  router.get('/vehicle-brands', controller.listVehicleBrands);
  router.post('/vehicle-brands', controller.createVehicleBrand);
  router.put('/vehicle-brands/:id', controller.updateVehicleBrand);
  router.patch('/vehicle-brands/:id/toggle-status', controller.toggleVehicleBrandStatus);

  router.patch('/users/:id/must-change-password', controller.setMustChangePassword);

  router.post('/sessions/cleanup', controller.cleanupDuplicateSessions);
  router.get('/login-sessions/recent', controller.getRecentLoginSessions);

  return router;
}

module.exports = buildAdminRouter;
