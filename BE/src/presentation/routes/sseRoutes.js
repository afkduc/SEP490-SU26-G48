/**
 * SSE Routes - Server-Sent Events endpoints cho realtime updates.
 *
 * Hien chi co /api/sse/login-sessions endpoint.
 * Client ket noi SSE, server push events khi co login/logout/force logout.
 */

const express = require('express');
const { onLoginSession } = require('../../application/events/LoginSessionEvents');

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

  return router;
}

module.exports = buildSSERouter;
