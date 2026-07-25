const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { requirePerm } = require('../../middlewares/permission');
const UserScreenPermissionsController = require('../controllers/UserScreenPermissionsController');

function buildUserScreenPermissionsRouter() {
  const router = express.Router({ mergeParams: true });
  const controller = new UserScreenPermissionsController();

  router.use(authenticate);

  // GET /api/admin/users/:userId/screen-permissions
  router.get('/', requirePerm('admin:users:read'), controller.getUserOverrides);

  // PUT /api/admin/users/:userId/screen-permissions
  router.put('/', requirePerm('admin:users:update'), controller.saveUserOverrides);

  // DELETE /api/admin/users/:userId/screen-permissions
  router.delete('/', requirePerm('admin:users:update'), controller.clearUserOverrides);

  // GET /api/admin/users/:userId/screen-permissions/effective
  router.get('/effective', requirePerm('admin:users:read'), controller.getEffectivePermissions);

  return router;
}

module.exports = buildUserScreenPermissionsRouter;
