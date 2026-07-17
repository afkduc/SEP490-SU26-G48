const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { validateListUsersQuery } = require('../validators/adminUserValidator');

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
  router.post('/reissue-token', authenticate, controller.reissueToken);

  router.use(authenticate, requireAdmin);

  router.get('/dashboard', controller.getDashboardStats);

  // Users
  router.get('/users', validateListUsersQuery, controller.listUsers);
  router.get('/users/export', controller.exportUsers);
  router.get('/users/:id', controller.getUserDetail);
  router.post('/users', controller.createUser);
  router.put('/users/:id', controller.updateUser);
  router.post('/users/:id/reset-password', controller.resetPassword);

  // Branches
  router.get('/branches', controller.listBranches);
  router.get('/branches/full', controller.listBranchesFull);
  router.get('/branches/manager-candidates', controller.getManagerCandidates);
  router.get('/branches/:id', controller.getBranchDetail);
  router.get('/branches/:id/stats', controller.getBranchStats);
  router.post('/branches', controller.createBranch);
  router.put('/branches/:id', controller.updateBranch);
  router.patch('/branches/:id/deactivate', controller.deactivateBranch);
  router.patch('/branches/:id/reactivate', controller.reactivateBranch);

  // Roles (UC-11)
  router.get('/roles', controller.listRoles);
  router.get('/roles/:id', controller.getRoleDetail);
  router.post('/roles', controller.createRole);
  router.put('/roles/:id', controller.updateRole);
  router.delete('/roles/:id', controller.deleteRole);
  router.get('/permissions', controller.listPermissions);
  router.get('/roles/:id/permissions', controller.getRolePermissions);
  router.put('/roles/:id/permissions', controller.setRolePermissions);
  router.get('/roles/:id/users', controller.getRoleUsers);

  // User roles (UC-12)
  router.get('/users/:userId/roles', controller.getUserRoles);
  router.post('/users/:userId/roles', controller.assignRoles);
  router.delete('/users/:userId/roles/:roleId', controller.revokeRole);

  // Devices
  router.get('/devices', controller.listDevices);
  router.get('/devices/user/:userId', controller.listUserDevices);
  router.delete('/devices/:deviceId', controller.forceLogoutDevice);
  router.delete('/devices/user/:userId/others', controller.forceLogoutAllOtherDevices);

  // Specialties
  router.get('/specialties', controller.listSpecialties);
  router.post('/specialties', controller.createSpecialty);
  router.put('/specialties/:id', controller.updateSpecialty);
  router.delete('/specialties/:id', controller.deleteSpecialty);
  router.get('/users/:userId/specialties', controller.getUserSpecialties);
  router.put('/users/:userId/specialties', controller.setUserSpecialties);

  // Security Alerts
  router.get('/security-alerts', controller.listSecurityAlerts);
  router.get('/security-alerts/counts', controller.acknowledgeAlertCounts);
  router.patch('/security-alerts/:id/ack', controller.acknowledgeAlert);

  return router;
}

module.exports = buildAdminRouter;
