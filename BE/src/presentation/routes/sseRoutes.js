/**
 * SSE Routes - Server-Sent Events endpoints cho realtime updates.
 *
 * Hien co 3 endpoint:
 *   - /api/sse/login-sessions    : admin watch login/logout/force events
 *   - /api/sse/notifications     : moi user nhan notification cua chinh minh
 *   - /api/sse/permissions       : moi user nhan event khi admin thay doi
 *                                  ma tran quyen / gan role / revoke role
 *                                  -> FE tu refresh permissions, khong can F5
 *
 * Client ket noi SSE, server push events khi co thay doi.
 *
 * QUAN TRONG (security):
 *   - Phai authenticate JWT (Bearer token tu query string `?token=` hoac
 *     Authorization header) va chi cho admin/manager ket noi (login-sessions).
 *   - Permissions/notifications: moi user authenticated deu ket noi duoc.
 *   - Truoc day route nay KHONG co auth -> bat ky ai cung stream duoc PII
 *     (email, IP, user-agent) -> SECURITY LEAK nghiem trong.
 *   - EventSource API cua browser KHONG ho tro custom headers, nen support
 *     token qua query string cho tien ich nhung VAN validate nhu Bearer header.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const { onLoginSession } = require('../../application/events/LoginSessionEvents');
const NotificationEvents = require('../../application/events/NotificationEvents');
const { onPermissionChanged } = require('../../application/events/PermissionEvents');
const { query } = require('../../infrastructure/database/sqlServer');

const ADMIN_ROLES = ['admin', 'manager', 'general_director'];

/**
 * Inline authentication cho SSE.
 * Ly do viet rieng (khong dung middleware.authenticate):
 *   - Middleware auth goi next(new ApiError(401, ...)) de Express error handler xu ly.
 *   - SSE da write headers -> khong the dung error handler nhu binh thuong.
 *   - Phai res.write 1 SSE error event roi res.end().
 *
 * @param {object} req - Express req
 * @param {object} res - Express res
 * @param {object} [options]
 * @param {boolean} [options.requireAdmin=false] - neu true, chi cho admin/manager/general_director
 * @returns {Promise<object|null>} decoded JWT payload hoac null (response da gui)
 */
async function authenticateSSE(req, res, options = {}) {
  const { requireAdmin = false } = options;
  // Lay token tu header Authorization hoac query string (?token=)
  // (EventSource API khong gui custom header, FE can gui qua query)
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Chưa đăng nhập',
      code: 'NO_TOKEN',
    });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
      code: 'INVALID_TOKEN',
    });
    return null;
  }

  // Kiem tra tokenVersion (single-session enforcement)
  if (decoded.userId) {
    try {
      const result = await query(
        `SELECT token_version FROM users WHERE id = @userId`,
        { userId: decoded.userId }
      );
      const dbVersion = result.recordset[0]?.token_version;
      if (dbVersion !== undefined && decoded.tokenVersion !== dbVersion) {
        res.status(401).json({
          success: false,
          message: 'Phiên đăng nhập đã hết hiệu lực',
          code: 'TOKEN_VERSION_MISMATCH',
        });
        return null;
      }
    } catch (err) {
      // DB loi -> cho phep tiep tuc nhung log warning, khong block stream
      console.warn('[sse] tokenVersion check failed:', err && err.message);
    }
  }

  // Kiem tra role neu can (admin-only SSE nhu login-sessions)
  if (requireAdmin) {
    const roles = decoded.roles || [];
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) {
      res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập SSE',
        code: 'FORBIDDEN',
      });
      return null;
    }
  }

  return decoded;
}

function buildSSERouter() {
  const router = express.Router();

  /**
   * GET /api/sse/login-sessions?token=<JWT>
   *
   * Server-Sent Events stream cho login session updates.
   * Client nhan cac event: 'login', 'logout', 'force'.
   *
   * Response headers:
   *   Content-Type: text/event-stream
   *   Cache-Control: no-cache
   *   Connection: keep-alive
   *
   * Event format:
   *   event: login-session
   *   data: {"type":"login","timestamp":"...","userName":"...","..."}
   */
  router.get('/login-sessions', async (req, res) => {
    // Authenticate TRUOC khi write headers SSE.
    // Neu fail, tra JSON error (van con headers JSON mac dinh, chua flush SSE).
    const decoded = await authenticateSSE(req, res, { requireAdmin: true });
    if (!decoded) return; // response already sent

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // Send initial heartbeat + user info
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        userId: decoded.userId,
      })}\n\n`
    );

    // Subscribe to login session events
    const unsubscribe = onLoginSession((eventType, eventData) => {
      try {
        res.write(`event: login-session\ndata: ${JSON.stringify(eventData)}\n\n`);
      } catch (writeErr) {
        // Client da disconnect trong khi write -> cleanup
        console.debug('[sse] write after disconnect:', writeErr && writeErr.message);
      }
    });

    // Heartbeat every 30s de keep-alive
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    // Cleanup on client disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
  });

  /**
   * GET /api/sse/notifications?token=<JWT>
   *
   * Stream notification realtime cho user hien tai (khong can admin role).
   * Moi notification moi tu NotificationService se duoc push ngay.
   * Moi user chi nhan notification cua chinh minh (filter theo userId tu JWT).
   *
   * Event format:
   *   event: notification
   *   data: {"id":123,"title":"...","message":"...","type":"LOGIN_SUCCESS",...}
   */
  router.get('/notifications', async (req, res) => {
    const decoded = await authenticateSSE(req, res);
    if (!decoded) return; // response already sent

    const userId = decoded.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Token khong chua userId',
        code: 'NO_USER_ID',
      });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        userId,
      })}\n\n`
    );

    // Subscribe to notifications cho user nay
    const unsubscribe = NotificationEvents.onNotification(userId, (notification) => {
      try {
        res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
      } catch (writeErr) {
        console.debug('[sse.notifications] write after disconnect:', writeErr && writeErr.message);
      }
    });

    // Heartbeat keep-alive 30s
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
  });

  /**
   * GET /api/sse/permissions?token=<JWT>
   *
   * Stream permission matrix changes cho user hien tai.
   * Moi khi admin thay doi ma tran quyen (role_permissions), gan role, hoac
   * revoke role -> server push SSE event 'permission-changed' den cac user
   * bi anh huong (filter theo userId tu JWT).
   *
   * Client (FE) nhan event -> goi GET /api/auth/me -> save token + permissions
   * moi vao localStorage -> PermissionGate re-render ngay (khong can F5).
   *
   * Event format:
   *   event: permission-changed
   *   data: {"action":"matrix_updated","roleIds":[2],"timestamp":"...","actorUserId":1}
   *
   * Security:
   *   - JWT required (Bearer hoac ?token=).
   *   - User chi nhan event neu co trong userIds cua payload (server-side filter).
   *   - Khong can role admin - moi user deu can lang nghe de refresh khi bi admin thay doi.
   */
  router.get('/permissions', async (req, res) => {
    const decoded = await authenticateSSE(req, res);
    if (!decoded) return; // response already sent

    const userId = Number(decoded.userId);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Token khong chua userId',
        code: 'NO_USER_ID',
      });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        userId,
      })}\n\n`
    );

    // Subscribe to PermissionEvents, filter theo userId cua connection nay.
    const unsubscribe = onPermissionChanged((eventData) => {
      try {
        // Chi push neu user hien tai co trong userIds bi anh huong
        const affected = Array.isArray(eventData.userIds) ? eventData.userIds : [];
        if (!affected.includes(userId)) return;

        // Push event (KHONG gui userIds/roleIds voi sensitive data lon)
        const payload = {
          action: eventData.action,
          roleIds: eventData.roleIds || [],
          timestamp: eventData.timestamp,
          actorUserId: eventData.actorUserId,
        };
        res.write(`event: permission-changed\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch (writeErr) {
        console.debug('[sse.permissions] write after disconnect:', writeErr && writeErr.message);
      }
    });

    // Heartbeat keep-alive 30s (giong cac SSE route khac)
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
  });

  return router;
}

module.exports = buildSSERouter;
