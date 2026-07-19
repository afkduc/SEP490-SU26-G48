const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../../application/services/AuthService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const DeviceService = require('../../application/services/DeviceService');
const { authenticate } = require('../../middlewares/auth');
const { trackLogout } = require('../../middlewares/loginSessionMiddleware');
const { success } = require('../../utils/response');

function buildAuthRouter() {
  const router = express.Router();

  const repo = new AuthRepositoryImpl();
  const service = new AuthService(repo);
  const controller = new AuthController(service);
  const deviceService = new DeviceService();

  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.getMe);
  router.post('/logout', authenticate, async (req, res, next) => {
    await trackLogout(req);
    return res.status(200).json({ message: 'Đăng xuất thành công' });
  });

  // Heartbeat de FE cap nhat last_activity_at theo dinh ky.
  // Tra ve serverTime de FE tinh clock offset, tranh UI hien thi sai gio.
  router.post('/heartbeat', authenticate, async (req, res, next) => {
    try {
      const deviceId = req.user && req.user.deviceId;
      if (!deviceId) {
        return success(res, { updated: false, serverTime: new Date().toISOString() }, 'Khong co deviceId trong token');
      }
      const result = await deviceService.heartbeat(deviceId);
      return success(res, result, 'Heartbeat OK');
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/server-time
  // Tra ve thoi gian server UTC (ISO8601). FE dung de tinh clock offset
  // giua client va server, tranh hien thi sai khi may client set gio sai.
  router.get('/server-time', (req, res) => {
    return success(res, { serverTime: new Date().toISOString() }, 'Server time UTC');
  });

  return router;
}

module.exports = buildAuthRouter;
