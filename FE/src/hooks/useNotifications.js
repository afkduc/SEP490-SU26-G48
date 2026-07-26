import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notificationApi';
import { dispatchLoginChallenge } from '../services/authApi';

const SSE_RECONNECT_DELAY_MS = 5000;
const SSE_RECONNECT_MAX_MS = 60_000;
const POLL_FALLBACK_MS = 60_000; // fallback polling 60s neu SSE fail

function parseNotifMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Nếu là LOGIN_CHALLENGE thì mở alert lớn xác nhận. */
function maybeOpenLoginChallenge(data) {
  if (!data || typeof window === 'undefined') return;
  const metadata = parseNotifMetadata(data.metadata);
  const type = data.type || data.eventType || metadata.eventType;
  if (type !== 'LOGIN_CHALLENGE') return;
  const pendingId = metadata.pendingId || data.pendingId;
  if (!pendingId) return;
  dispatchLoginChallenge({
    pendingId,
    metadata,
    title: data.title,
    message: data.message,
    device: [metadata.browser, metadata.os].filter(Boolean).join(' · ') || undefined,
    ip: metadata.ip,
  });
}

/**
 * Hook realtime notifications.
 *
 * Ket noi SSE /api/sse/notifications?token=<JWT>, push notification moi vao
 * `notifications` state va tang unreadCount. Fallback polling unread-count
 * 60s/lan neu SSE fail (tranh mat notification khi proxy chan SSE).
 *
 * @param {string|null} token - JWT de auth SSE (lay tu localStorage/sessionStorage)
 * @param {object} [options]
 * @param {number} [options.maxItems=20] - gioi han so notification luu trong state
 * @returns {{
 *   notifications: Array,
 *   unreadCount: number,
 *   loading: boolean,
 *   error: string|null,
 *   connected: boolean,
 *   refresh: () => Promise<void>,
 *   markRead: (id: number|string) => Promise<void>,
 *   markAllRead: () => Promise<void>,
 * }}
 */
export function useNotifications(token, options = {}) {
  const { maxItems = 20 } = options;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  const esRef = useRef(null);
  const pollTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const tokenRef = useRef(token);
  const stoppedRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // === Data operations ===

  const refresh = useCallback(async () => {
    try {
      const list = await getNotifications({ limit: maxItems });
      const items = Array.isArray(list) ? list : (list?.items || []);
      setNotifications(items);
      // Dem unread tu list (tranh 1 extra request neu list da co)
      setUnreadCount(items.filter((n) => !n.isRead && !n.readAt).length);
      setError(null);
    } catch (err) {
      console.warn('[useNotifications] refresh error:', err && err.message);
      setError(err && err.message);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      const count = typeof res === 'object' && res !== null
        ? Number(res.count ?? res.unreadCount ?? res)
        : Number(res);
      if (Number.isFinite(count)) {
        setUnreadCount(Math.max(0, count));
      }
    } catch (err) {
      console.debug('[useNotifications] getUnreadCount error:', err && err.message);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    // Optimistic update: danh dau read ngay trong state de UI responsive.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markAsRead(id);
    } catch (err) {
      // Rollback neu fail
      console.warn('[useNotifications] markRead error:', err && err.message);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false, readAt: null } : n))
      );
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    // Optimistic
    const previousUnread = unreadCount;
    const previousItems = notifications;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await markAllAsRead();
    } catch (err) {
      console.warn('[useNotifications] markAllRead error:', err && err.message);
      // Rollback
      setNotifications(previousItems);
      setUnreadCount(previousUnread);
    }
  }, [notifications, unreadCount]);

  // === SSE connection ===

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    stoppedRef.current = false;
    let failCount = 0;

    const scheduleReconnect = () => {
      if (stoppedRef.current) return;
      const delay = Math.min(
        SSE_RECONNECT_MAX_MS,
        SSE_RECONNECT_DELAY_MS * Math.max(1, 2 ** Math.min(failCount, 5))
      );
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (stoppedRef.current) return;
      if (!tokenRef.current) return;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        try { esRef.current.close(); } catch { /* ignore */ }
        esRef.current = null;
      }

      const qs = `?token=${encodeURIComponent(tokenRef.current)}`;
      const url = `${API_BASE_URL}/sse/notifications${qs}`;
      try {
        const es = new EventSource(url);
        esRef.current = es;

        es.addEventListener('connected', () => {
          failCount = 0;
          setConnected(true);
          setError(null);
        });

        es.addEventListener('notification', (e) => {
          try {
            const data = JSON.parse(e.data);
            setNotifications((prev) => {
              const next = [data, ...prev.filter((n) => n.id !== data.id)];
              return next.slice(0, maxItems);
            });
            const wasRead = Boolean(data.isRead || data.readAt);
            if (!wasRead) {
              setUnreadCount((c) => c + 1);
            }
            maybeOpenLoginChallenge(data);
          } catch (parseErr) {
            console.warn('[useNotifications] parse SSE error:', parseErr);
          }
        });

        const onError = () => {
          setConnected(false);
          failCount += 1;
          try { es.close(); } catch { /* ignore */ }
          esRef.current = null;
          scheduleReconnect();
        };
        es.addEventListener('error', onError);
        es.onerror = onError;
      } catch (err) {
        console.warn('[useNotifications] EventSource construct error:', err);
        setConnected(false);
        failCount += 1;
        scheduleReconnect();
      }
    };

    refresh();
    refreshUnreadCount();
    connect();

    pollTimerRef.current = setInterval(() => {
      if (!esRef.current || esRef.current.readyState !== 1) {
        refreshUnreadCount();
      }
    }, POLL_FALLBACK_MS);

    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (esRef.current) {
        try { esRef.current.close(); } catch { /* ignore */ }
        esRef.current = null;
      }
    };
  }, [token, maxItems, refresh, refreshUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    connected,
    refresh,
    markRead,
    markAllRead,
  };
}
