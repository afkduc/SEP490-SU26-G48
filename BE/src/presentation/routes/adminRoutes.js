const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { validateListUsersQuery } = require('../validators/adminUserValidator');

/**
 * Admin routes - chi danh cho user co role admin
 *
 * GET /api/admin/dashboard
 *   - Tra ve thong ke tong quan cho admin
 *
 * GET /api/admin/users
 *   Query params (all optional):
 *     - search    : chuoi tim kiem theo user_name/email/full_name (LIKE)
 *     - branchId  : ID chi nhanh (so nguyen duong)
 *     - roleId    : ten role (role_name) - loc user co role do
 *     - status    : active | inactive | locked
 *     - page      : so trang (mac dinh 1, >= 1)
 *     - pageSize  : so ban ghi moi trang (mac dinh 10, 1-100)
 *   Response: { items, total, page, pageSize }
 *
 * GET /api/admin/branches
 *   - Tra ve danh sach chi nhanh (id, branchName) de dung cho filter dropdown
 *   Response: { items: [{id, branchName}], total }
 *
 * GET /api/admin/roles
 *   - Tra ve danh sach role (id, roleName) de dung cho filter dropdown
 *   - Roles nay cung duoc dung chung cho UC-11 (phan quyen user)
 *   Response: { items: [{id, roleName}], total }
 */
function buildAdminRouter() {
  const router = express.Router();
  const controller = new AdminController();

  router.use(authenticate, requireAdmin);

  router.get('/dashboard', controller.getDashboardStats);
  router.get('/users', validateListUsersQuery, controller.listUsers);
  router.get('/users/:id', controller.getUserDetail);
  router.post('/users', controller.createUser);
  router.put('/users/:id', controller.updateUser);
  router.get('/branches', controller.listBranches);
  router.get('/roles', controller.listRoles);

  return router;
}

module.exports = buildAdminRouter;