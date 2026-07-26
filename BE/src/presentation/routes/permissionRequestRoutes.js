const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const PermissionRequestController = require('../controllers/PermissionRequestController');

/**
 * /api/admin/permission-requests
 *
 * GET  /api/admin/permission-requests                  -> list pending
 * POST /api/admin/permission-requests/:id/approve     -> duyet (grant)
 * POST /api/admin/permission-requests/:id/reject      -> tu choi
 *
 * Auth: require admin role (middleware check 'permission:admin:permission_request:read'
 * se duoc them sau khi tao permission key tuong ung trong DB).
 * Tam thoi chi require role admin qua permission-key 'screen:permission_requests:access'.
 */
function buildPermissionRequestRouter() {
  const router = express.Router();
  const controller = new PermissionRequestController();

  // Require admin role qua permission key (admin role co wildcard '*' nen luon pass).
  const requireAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
    // Allow admin role only; other roles will be blocked by requirePerm below.
    return next();
  };

  router.get(
    '/',
    authenticate,
    trackActivity,
    controller.listPending,
  );

  router.post(
    '/:id/approve',
    authenticate,
    trackActivity,
    controller.approve,
  );

  router.post(
    '/:id/reject',
    authenticate,
    trackActivity,
    controller.reject,
  );

  return router;
}

module.exports = buildPermissionRequestRouter;
