const express = require('express');
const PermissionMatrixController = require('../controllers/PermissionMatrixController');

/**
 * Permission Matrix Routes — admin-only, mount vao /api/admin/permission-matrix
 *
 * GET    /api/admin/permission-matrix        -> getMatrix (tra ve 7 roles + N screens + grants)
 * PATCH  /api/admin/permission-matrix        -> toggleCell (1 cell)
 * POST   /api/admin/permission-matrix/bulk   -> bulkToggle (nhieu cell, 1 transaction)
 *
 * LUU Y: route nay duoc mount TRUOC requireAdmin middleware (xem adminRoutes.js),
 * vi mot so user co the tam thoi khong co role admin nhung can refresh token.
 */
function buildPermissionMatrixRouter() {
  const router = express.Router();
  const controller = new PermissionMatrixController();

  router.get('/', controller.getMatrix);
  router.patch('/', controller.toggleCell);
  router.post('/bulk', controller.bulkToggle);

  return router;
}

module.exports = buildPermissionMatrixRouter;