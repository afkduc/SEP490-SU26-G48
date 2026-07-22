/**
 * SSE Routes - Server-Sent Events endpoints cho realtime updates.
 *
 * /api/sse/login-sessions: client ket noi SSE, server push khi co
 *   login/logout/force logout.
 * /api/sse/service-requests: server push "Yeu cau" moi/duoc tiep nhan tu
 *   form Lien he cua landing page, scope theo branchId cua CVDV.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { onLoginSession } = require('../../application/events/LoginSessionEvents');
const { onServiceRequestEvent } = require('../../application/events/ServiceRequestEvents');

function buildSSERouter() {
  const router = express.Router();

  /**
   * GET /api/sse/login-sessions
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
  router.get('/login-sessions', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // Send initial heartbeat
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    // Subscribe to login session events
    const unsubscribe = onLoginSession((eventType, eventData) => {
      res.write(`event: login-session\ndata: ${JSON.stringify(eventData)}\n\n`);
    });

    // Heartbeat every 30s de keep-alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    // Cleanup on client disconnect
    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/service-requests?token=...
   *
   * EventSource cua trinh duyet khong gui duoc header Authorization, nen
   * phai xac thuc thu cong qua query param "token" (thay vi middleware
   * authenticate() thong thuong doc tu header).
   *
   * Chi push event cho dung branchId cua CVDV dang ket noi - tranh lo thong
   * tin khach hang cua chi nhanh khac.
   */
  router.get('/service-requests', (req, res) => {
    let decoded;
    try {
      decoded = jwt.verify(req.query.token, config.jwtSecret);
    } catch {
      return res.status(401).end();
    }
    if (!decoded.branchId) {
      return res.status(403).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const unsubscribe = onServiceRequestEvent(decoded.branchId, (eventData) => {
      res.write(`event: service-request\ndata: ${JSON.stringify(eventData)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  return router;
}

module.exports = buildSSERouter;
