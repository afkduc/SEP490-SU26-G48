const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const ProfileController = require('../controllers/ProfileController');
const ProfileService = require('../../application/services/ProfileService');
const ProfileRepositoryImpl = require('../../infrastructure/repositories/ProfileRepositoryImpl');

function buildProfileRouter() {
  const router = express.Router();

  const repo = new ProfileRepositoryImpl();
  const service = new ProfileService(repo);
  const controller = new ProfileController(service);

  // Lấy thông tin profile hiện tại (chính mình)
  router.get('/me', authenticate, trackActivity, controller.getMyProfile);

  // Cập nhật thông tin cá nhân
  router.put('/me', authenticate, trackActivity, controller.updateMyProfile);

  // Đổi mật khẩu
  router.put('/me/password', authenticate, trackActivity, controller.changePassword);

  // === Notification Endpoints ===

  // Lấy cài đặt thông báo
  router.get('/me/notifications/settings', authenticate, controller.getNotificationSettings);

  // Cập nhật cài đặt thông báo
  router.put('/me/notifications/settings', authenticate, controller.updateNotificationSettings);

  // Lấy danh sách thông báo
  router.get('/me/notifications', authenticate, controller.getNotifications);

  // Đánh dấu một thông báo đã đọc
  router.patch('/me/notifications/:id/read', authenticate, controller.markNotificationRead);

  // Đánh dấu tất cả thông báo đã đọc
  router.patch('/me/notifications/read-all', authenticate, controller.markAllNotificationsRead);

  // Lấy số thông báo chưa đọc
  router.get('/me/notifications/unread-count', authenticate, controller.getUnreadCount);

  return router;
}

module.exports = buildProfileRouter;
