const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../../application/services/AuthService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const DeviceService = require('../../application/services/DeviceService');
const { authenticate } = require('../../middlewares/auth');
const { trackLogout } = require('../../middlewares/loginSessionMiddleware');
const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');

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
  // QUAN TRONG: moi loi deu duoc try/catch -> tra 401/403/500 co
  // STATUS CODE ro rang, KHONG de exception lan ra server crash.
  router.post('/heartbeat', authenticate, async (req, res, next) => {
    const sendError = (status, message) => {
      // Dung success() wrapper de giong format cac response khac
      if (status >= 500) {
        return next(new ApiError(status, message));
      }
      return res.status(status).json({
        success: false,
        message,
        status,
      });
    };

    try {
      const deviceId = req.user && req.user.deviceId;
      if (!deviceId) {
        // Token khong co deviceId -> tra 401 (token cu / chua login dung flow).
        // FE se hieu va yeu cau login lai.
        return sendError(401, 'Thiết bị chưa đăng ký. Vui lòng đăng nhập lại.');
      }

      let result;
      try {
        result = await deviceService.heartbeat(deviceId);
      } catch (serviceErr) {
        // Loi DB (cot thieu / bang thieu) -> 503 Service Unavailable (dung)
        // thay vi 500. FE khong show SessionExpiredModal cho 503.
        console.error('[heartbeat] DeviceService error:', serviceErr?.message || serviceErr);
        return sendError(503, 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.');
      }

      return success(res, result, 'Heartbeat OK');
    } catch (err) {
      console.error('[heartbeat] unexpected error:', err?.message || err);
      return next(new ApiError(500, 'Lỗi máy chủ nội bộ'));
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
