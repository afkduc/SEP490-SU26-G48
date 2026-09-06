/**
 * SSE Routes - Server-Sent Events endpoints cho realtime updates.
 *
 * /api/sse/login-sessions: client ket noi SSE, server push khi co
 *   login/logout/force logout.
 * /api/sse/notifications: server push thong bao in-app + LOGIN_CHALLENGE.
 * /api/sse/service-requests: server push "Yeu cau" moi/duoc tiep nhan tu
 *   form Lien he cua landing page, scope theo branchId cua CVDV.
 * /api/sse/permissions: server push khi admin thay doi permission matrix.
 *   Push toi DUNG user dang bi anh huong (filter theo userId trong JWT).
 * /api/sse/repair-orders: server push khi co lenh sua chua moi duoc giao,
 *   dau muc cong viec duoc tich hoan thanh, hoac lenh hoan thanh toan bo -
 *   scope theo branchId cua CVDV/to truong dang ket noi.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { onLoginSession } = require('../../application/events/LoginSessionEvents');
const { onServiceRequestEvent } = require('../../application/events/ServiceRequestEvents');
const { onPermissionChanged } = require('../../application/events/PermissionEvents');
const { onRepairOrderEvent } = require('../../application/events/RepairOrderEvents');
const notificationEvents = require('../../application/events/NotificationEvents');

function buildSSERouter() {
  const router = express.Router();

  /**
   * GET /api/sse/login-sessions
   */
  router.get('/login-sessions', (req, res) => {
    let decoded;
    try {
      decoded = jwt.verify(req.query.token, config.jwtSecret);
    } catch {
      return res.status(401).end();
    }
    if (!decoded.userId) {
      return res.status(403).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const unsubscribe = onLoginSession((eventType, eventData) => {
      res.write(`event: login-session\ndata: ${JSON.stringify(eventData)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/notifications?token=...
   *
   * Stream thông báo realtime (chuông + LOGIN_CHALLENGE).
   * EventSource không gửi Authorization header → auth qua query token.
   *
   * Event format:
   *   event: notification
   *   data: { id, title, message, type, severity, metadata, ... }
   */
  router.get('/notifications', (req, res) => {
    let decoded;
    try {
      decoded = jwt.verify(req.query.token, config.jwtSecret);
    } catch {
      return res.status(401).end();
    }
    if (!decoded.userId) {
      return res.status(403).end();
    }

    const userId = String(decoded.userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ status: 'connected', userId })}\n\n`
    );

    const unsubscribe = notificationEvents.onNotification(userId, (notification) => {
      try {
        res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
      } catch (writeErr) {
        console.warn('[sse/notifications] write failed:', writeErr.message);
      }
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        /* ignore */
      }
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/service-requests?token=...
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

  /**
   * GET /api/sse/permissions?token=...
   */
  router.get('/permissions', (req, res) => {
    let decoded;
    try {
      decoded = jwt.verify(req.query.token, config.jwtSecret);
    } catch {
      return res.status(401).end();
    }
    if (!decoded.userId) {
      return res.status(403).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', userId: decoded.userId })}\n\n`);

    const myUserId = Number(decoded.userId);

    const unsubscribe = onPermissionChanged((eventData) => {
      const userIds = Array.isArray(eventData.userIds) ? eventData.userIds : [];
      const affected = userIds.some((id) => Number(id) === myUserId);
      if (!affected) return;

      try {
        res.write(`event: permission-changed\ndata: ${JSON.stringify(eventData)}\n\n`);
      } catch (writeErr) {
        console.warn('[sse/permissions] write failed:', writeErr.message);
      }
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/repair-orders?token=...
   */
  router.get('/repair-orders', (req, res) => {
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

    const unsubscribe = onRepairOrderEvent(decoded.branchId, (eventData) => {
      res.write(`event: repair-order\ndata: ${JSON.stringify(eventData)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/gate?branchId=1
   *
   * Public (khong dang nhap) - man hinh bao ve tai cong (xem publicRoutes.js
   * /public/gate/*). Chi bao "co gi do thay doi, tu goi lai API list" (type
   * 'invoiced' | 'gate-exit-confirmed'), khong day du lieu khach hang qua
   * kenh nay - giu it thong tin nhat co the tren 1 kenh khong xac thuc.
   */
  router.get('/gate', (req, res) => {
    const branchId = Number(req.query.branchId);
    if (!branchId) {
      return res.status(400).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const unsubscribe = onRepairOrderEvent(branchId, (eventData) => {
      if (eventData.type !== 'invoiced' && eventData.type !== 'gate-exit-confirmed') return;
      res.write(`event: gate\ndata: ${JSON.stringify({ type: eventData.type })}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  /**
   * GET /api/sse/bay-board?branchId=1
   *
   * Public (khong dang nhap) - man khoang xe "/bay/<chi nhanh>/<so
   * khoang>" tren Landing (xem publicRoutes.js /public/bays/*). Forward
   * nguyen payload cho 'new-pending' | 'claimed' | 'order-cancelled' |
   * 'task-updated' - cac event nay von khong chua SDT/tong tien (chi
   * orderId/code/bayNumber/cancelReason/taskId), da o muc chap
   * nhan duoc de lo qua kenh khong xac thuc (giong nhu da chap nhan cho
   * /sse/gate). 'task-updated' o day con bao ca truong hop CVDV sua phieu
   * (vd khach huy 1 hang muc giua chung) lam checklist thay doi, khong chi
   * rieng luc to truong/tho tu tick - xem RepairSettlementService.update().
   */
  router.get('/bay-board', (req, res) => {
    const branchId = Number(req.query.branchId);
    if (!branchId) {
      return res.status(400).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    // 'bay-reported' (khoang bao xong viec) va 'order-completed' (to truong
    // xac nhan, khoang duoc giai phong) cung chi chua orderId/code/bayId nhu
    // cac event con lai - khong lo them gi qua kenh khong xac thuc.
    const RELEVANT_TYPES = new Set([
      'new-pending', 'claimed', 'order-cancelled', 'task-updated',
      'bay-reported', 'order-completed',
    ]);
    const unsubscribe = onRepairOrderEvent(branchId, (eventData) => {
      if (!RELEVANT_TYPES.has(eventData.type)) return;
      res.write(`event: bay-board\ndata: ${JSON.stringify(eventData)}\n\n`);
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
