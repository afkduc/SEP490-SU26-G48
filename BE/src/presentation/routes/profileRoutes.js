const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const ProfileController = require('../controllers/ProfileController');
const ProfileService = require('../../application/services/ProfileService');
const ProfileRepositoryImpl = require('../../infrastructure/repositories/ProfileRepositoryImpl');

function buildProfileRouter() {
  const router = express.Router();

  const repo = new ProfileRepositoryImpl();
  const service = new ProfileService(repo);
  const controller = new ProfileController(service);

  // Lấy thông tin profile hiện tại (chính mình)
  router.get('/me', authenticate, controller.getMyProfile);

  // Cập nhật thông tin cá nhân
  router.put('/me', authenticate, controller.updateMyProfile);

  // Đổi mật khẩu
  router.put('/me/password', authenticate, controller.changePassword);

  return router;
}

module.exports = buildProfileRouter;
