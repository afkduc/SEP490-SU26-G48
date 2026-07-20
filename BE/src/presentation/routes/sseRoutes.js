/**
 * SSE Routes - Server-Sent Events endpoints cho realtime updates.
 *
 * Hien chi co /api/sse/login-sessions endpoint.
 * Client ket noi SSE, server push events khi co login/logout/force logout.
 *
 * QUAN TRONG (security):
 *   - Phai authenticate JWT (Bearer token tu query string `?token=` hoac
 *     Authorization header) va chi cho admin/manager ket noi.
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
const { query } = require('../../infrastructure/database/sqlServer');

const ADMIN_ROLES = ['admin', 'manager', 'general_director'];

/**
 * Inline authentication cho SSE.
 * Ly do viet rieng (khong dung middleware.authenticate):
 *   - Middleware auth goi next(new ApiError(401, ...)) de Express error handler xu ly.
 *   - SSE da write headers -> khong the dung error handler nhu binh thuong.
 *   - Phai res.write 1 SSE error event roi res.end().
 */
async function authenticateSSE(req, res) {
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

  // Kiem tra role admin/manager (chi admin moi can SSE login-sessions)
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
    const decoded = await authenticateSSE(req, res);
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

  return router;
}

module.exports = buildSSERouter;
