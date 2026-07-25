const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { requirePerm } = require('../../middlewares/permission');
const RoleScreenMatrixController = require('../controllers/RoleScreenMatrixController');

function buildRoleScreenMatrixRouter() {
  const router = express.Router();
  const controller = new RoleScreenMatrixController();

  // Tat ca endpoints yeu cau admin permission
  router.use(authenticate);

  // GET /api/admin/role-screen-matrix/screens - auto-discovered screens
  router.get('/screens', requirePerm('admin:permissions:read'), controller.getAvailableScreens);

  // GET /api/admin/role-screen-matrix?roleId=1 - matrix cua 1 role
  router.get('/', requirePerm('admin:permissions:read'), controller.getMatrix);

  // PUT /api/admin/role-screen-matrix?roleId=1 - luu matrix
  router.put('/', requirePerm('admin:permissions:update'), controller.saveMatrix);

  // GET /api/admin/role-screen-matrix/compare?roleIds=1,2,3
  router.get('/compare', requirePerm('admin:permissions:read'), controller.compareMatrix);

  return router;
}

module.exports = buildRoleScreenMatrixRouter;
