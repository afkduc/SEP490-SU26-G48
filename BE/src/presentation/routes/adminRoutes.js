const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { validateListUsersQuery } = require('../validators/adminUserValidator');

/**
 * Admin routes - chi danh cho user co role admin
 *
 * GET  /api/admin/dashboard
 * GET  /api/admin/users
 * GET  /api/admin/users/:id
 * POST /api/admin/users
 * PUT  /api/admin/users/:id
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

  router.use(authenticate, requireAdmin);

  router.get('/dashboard', controller.getDashboardStats);

  // Users
  router.get('/users', validateListUsersQuery, controller.listUsers);
  router.get('/users/:id', controller.getUserDetail);
  router.post('/users', controller.createUser);
  router.put('/users/:id', controller.updateUser);

  // Branches
  router.get('/branches', controller.listBranches);

  // Roles (UC-11)
  router.get('/roles', controller.listRoles);
  router.get('/roles/:id', controller.getRoleDetail);

  // User roles (UC-12)
  router.get('/users/:userId/roles', controller.getUserRoles);
  router.post('/users/:userId/roles', controller.assignRoles);
  router.delete('/users/:userId/roles/:roleId', controller.revokeRole);

  return router;
}

module.exports = buildAdminRouter;
