const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const ProfileController = require('../controllers/ProfileController');
const ProfileService = require('../../application/services/ProfileService');
const ProfileRepositoryImpl = require('../../infrastructure/repositories/ProfileRepositoryImpl');
const { validateUpdateProfile } = require('../validators/profileValidator');

function buildProfileRouter() {
  const router = express.Router();

  const repo = new ProfileRepositoryImpl();
  const service = new ProfileService(repo);
  const controller = new ProfileController(service);

  router.get('/me', authenticate, trackActivity, controller.getMyProfile);
  router.put('/me', authenticate, trackActivity, validateUpdateProfile, controller.updateMyProfile);

  // Change-password self-service removed — use forgot-password / admin reset.

  router.get('/me/notifications/settings', authenticate, controller.getNotificationSettings);
  router.put('/me/notifications/settings', authenticate, controller.updateNotificationSettings);
  router.get('/me/notifications', authenticate, controller.getNotifications);
  router.patch('/me/notifications/:id/read', authenticate, controller.markNotificationRead);
  router.patch('/me/notifications/read-all', authenticate, controller.markAllNotificationsRead);
  router.get('/me/notifications/unread-count', authenticate, controller.getUnreadCount);

  // Device trust removed. Self logout-all kept for My account flow.
  router.post('/me/devices/logout-all', authenticate, trackActivity, controller.logoutAllMyDevices);

  return router;
}

module.exports = buildProfileRouter;
