const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../../application/services/AuthService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const DeviceService = require('../../application/services/DeviceService');
const { authenticate } = require('../../middlewares/auth');
const { trackLogout } = require('../../middlewares/loginSessionMiddleware');
const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { query } = require('../../infrastructure/database/sqlServer');

function buildAuthRouter() {
  const router = express.Router();

  const repo = new AuthRepositoryImpl();
  const service = new AuthService(repo);
  const controller = new AuthController(service);
  const deviceService = new DeviceService();

  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.getMe);

  /**
   * POST /api/auth/refresh-permissions
   *
   * Re-issue JWT voi permissions moi nhat tu DB (bo qua cache).
   *
   * Use case:
   *   - FE nhan SSE event 'permission-changed' tu /api/sse/permissions
   *     (admin vua thay doi ma tran quyen / gan role / revoke role).
   *   - Token hien tai van co permissions cu trong payload (24h cache).
   *   - FE goi endpoint nay de lay token moi + permissions moi -> luu vao
   *     localStorage -> PermissionGate re-render ngay.
   *
   * Tra ve:
   *   200 { token, user } - thanh cong, FE save vao storage
   *   401 - token khong hop le
   *   503 - DB loi (khong the lay permission moi)
   *
   * LUU Y: endpoint nay KHONG thay doi tokenVersion, KHONG logout cac
   * thiet bi khac (giong nhu "soft refresh"). No chi tao JWT moi voi
   * permission list moi nhat, user van giu session cu.
   */
  router.post('/refresh-permissions', authenticate, async (req, res, next) => {
    try {
      const userId = req.user && req.user.userId;
      if (!userId) {
        return next(new ApiError(401, 'Token khong chua userId'));
      }

      // Lay user info moi tu DB (can cho token payload)
      let freshUser;
      try {
        const result = await query(
          `SELECT id, pseudo_id, user_name, email,
                  first_name, last_name, phone, branch_id, status, avatar,
                  must_change_password, token_version
           FROM   users
           WHERE  id = @userId AND status = 'active'`,
          { userId }
        );
        freshUser = result.recordset[0] || null;
      } catch (dbErr) {
        console.error('[auth.refresh-permissions] query user failed:', dbErr?.message || dbErr);
        return next(new ApiError(503, 'Khong the lay thong tin user tu DB'));
      }
      if (!freshUser) {
        return next(new ApiError(401, 'User khong ton tai hoac bi vo hieu hoa'));
      }

      // Re-issue token voi permissions moi tu DB. PermissionService se
      // bypass cache (chi refresh path) de dam bao lay permission moi nhat
      // ngay sau khi admin thay doi (tranh 60s cache TTL).
      let refreshed;
      try {
        const deviceId = req.user.deviceId || null;
        freshUser.sessionId = req.user.sessionId || null;
        refreshed = await service.issueTokenWithDevice(freshUser, deviceId);
      } catch (signErr) {
        console.error('[auth.refresh-permissions] issueToken failed:', signErr?.message || signErr);
        return next(new ApiError(503, 'Khong the tao token moi'));
      }

      return success(res, refreshed, 'Refresh permissions thanh cong');
    } catch (err) {
      console.error('[auth.refresh-permissions] unexpected:', err?.message || err);
      return next(new ApiError(500, 'Loi may chu noi bo'));
    }
  });
  router.post('/logout', authenticate, async (req, res, next) => {
    // QUAN TRONG (try/catch 2 lop):
    // - trackLogout internal da co try/catch rieng (line 315-397 middleware),
    //   nhung neu loi bat ngo (vd: req.user undefined do token decode
    //   thanh cong nhung middleware khong gan req.user) -> throw ra ngoai ->
    //   Express default 500.
    // - Them try/catch ngoai de dam bao logout API luon tra 200 (FE cleanup
    //   token local), chi log warning khi track that bai.
    try {
      try {
        await trackLogout(req);
      } catch (trackErr) {
        // Track fail KHONG chan user logout (FE da clear token local).
        // Log warning de debug, tra ve 200 van.
        console.warn(
          '[authRoutes.logout] trackLogout fail (user logout van thanh cong local):',
          trackErr && trackErr.message ? trackErr.message : trackErr
        );
      }
      return res.status(200).json({ message: 'Đăng xuất thành công' });
    } catch (unexpectedErr) {
      // Loi bat ngo (khong phai tu trackLogout ma tu chinh route handler).
      // VD: req.user null, memory leak, etc.
      console.error(
        '[authRoutes.logout] unexpected:',
        unexpectedErr && unexpectedErr.message ? unexpectedErr.message : unexpectedErr
      );
      return next(new ApiError(500, 'Lỗi máy chủ nội bộ'));
    }
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
