import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { LOGOUT_KEY, consumeSkipNextPermissionChange } from '../../services/httpClient';

const SSE_RECONNECT_DELAY_MS = 5000;
const REFRESH_API_TIMEOUT_MS = 10000;
// Cooldown giua 2 lan refresh permission de tranh loop khi BE broadcast
// lien tuc nhieu event (VD: cac tab khac dang sua nhieu role cung luc).
const REFRESH_COOLDOWN_MS = 1500;

/**
 * Hook SSE lang nghe permission-changed events tu server.
 *
 * Flow khi admin thay doi ma tran quyen:
 *   1. BE emit 'permission-changed' qua /api/sse/permissions (filter theo userId)
 *   2. Hook nhan event -> goi POST /api/auth/refresh-permissions (BE re-issue JWT)
 *   3. Nhan token moi + user moi -> luu vao storage + cap nhat React state
 *   4. PermissionGate re-render ngay (khong can F5)
 *
 * Reconnect:
 *   - Mat ket noi (network, server restart) -> reconnect sau 5s
 *   - Auth fail (401) -> KHONG reconnect vo han (user phai login lai)
 *
 * @param {object} params
 * @param {boolean} params.enabled - bat/tat SSE (chi subscribe khi login xong)
 * @param {string|null} params.token - JWT hien tai (lay tu localStorage/sessionStorage)
 * @param {function} params.onPermissionChanged - callback khi nhan event (optional,
 *   dung de hien toast "Quyen cua ban vua duoc cap nhat"). Mac dinh: chi silent refresh.
 * @returns {{ connected: boolean, refreshing: boolean, lastRefreshAt: number|null, error: string|null }}
 */
export function usePermissionEventsSSE({ enabled = true, token = null, onPermissionChanged = null } = {}) {
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const tokenRef = useRef(token);
  const onEventRef = useRef(onPermissionChanged);
  const enabledRef = useRef(enabled);
  // Dem so lan SSE fail lien tiep - neu >= 2 lan -> refresh token truoc
  const authFailCountRef = useRef(0);
  // Timestamp cua lan refresh gan nhat -> dung cooldown de tranh loop.
  const lastRefreshAtRef = useRef(0);
  // Set neu co 1 refresh dang chay (de tranh 2 refresh song song).
  const refreshInFlightRef = useRef(false);

  // Sync refs khi props thay doi (tranh stale closure nhung khong reconnect)
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    onEventRef.current = onPermissionChanged;
  }, [onPermissionChanged]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  /**
   * POST /api/auth/refresh-permissions de lay token moi.
   *
   * QUAN TRONG (.cursorrules): phai luu token MOI vao storage TRUOC khi
   * cap nhat React state (tranh race condition).
   */
  const refreshPermissions = async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      console.warn('[usePermissionEventsSSE] refresh skipped: no token');
      return;
    }

    // Chong loop: neu co refresh khac dang chay, hoac refresh gan day
    // (trong REFRESH_COOLDOWN_MS), bo qua. Day fix tinh trang BE broadcast
    // lien tuc nhieu event (VD: admin luu matrix -> trigger 1 refresh ->
    // refresh xong set state -> ProtectedRoute re-mount -> ...).
    if (refreshInFlightRef.current) {
      return;
    }
    const now = Date.now();
    if (now - lastRefreshAtRef.current < REFRESH_COOLDOWN_MS) {
      return;
    }
    lastRefreshAtRef.current = now;
    refreshInFlightRef.current = true;

    setRefreshing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REFRESH_API_TIMEOUT_MS);

      const response = await fetch(`${API_BASE_URL}/auth/refresh-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // 401/403 -> token het han, dung reconnect (user phai login lai)
        if (response.status === 401 || response.status === 403) {
          console.warn('[usePermissionEventsSSE] refresh 401/403, stop SSE');
          setError('Token khong hop le, vui long dang nhap lai');
          // Close SSE connection, user can F5 sau khi login
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const payload = json && (json.data || json);
      const newToken = payload?.token;
      const newUser = payload?.user;

      if (!newToken || !newUser) {
        console.warn('[usePermissionEventsSSE] refresh response missing token/user');
        return;
      }

      // Ưu tiên effectivePermissions (full L2); fallback user.permissions (BE đã gắn full khi refresh).
      const newPermissions = Array.isArray(payload?.effectivePermissions)
        ? payload.effectivePermissions
        : (Array.isArray(newUser.permissions) ? newUser.permissions : []);

      // Xac dinh storage (local hay session) dua vao token hien tai
      const inLocal = localStorage.getItem('token');
      const storage = currentToken === inLocal ? localStorage : sessionStorage;

      // QUAN TRONG: luu token moi vao storage TRUOC, dispatch event sau.
      // AppContext se lang nghe 'storage' event va cap nhat React state.
      // Day la flow "storage first, state last" theo .cursorrules.
      storage.setItem('token', newToken);
      storage.setItem('user', JSON.stringify(newUser));
      storage.setItem('permissions', JSON.stringify(newPermissions));

      // Cross-tab broadcast (neu co BroadcastChannel)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('app-session');
          channel.postMessage({ token: newToken, user: newUser, permissions: newPermissions });
          channel.close();
        }
      } catch {
        /* ignore */
      }

      // Trigger 'storage' event manually cho SAME-TAB listeners (storage event
      // chi fire cross-tab). AppContext cung co BroadcastChannel listener,
      // nhung mot so component khac co the chi nghe storage event.
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'token',
          newValue: newToken,
          storageArea: storage,
        }));
      } catch {
        /* ignore (browser cu khong ho tro) */
      }

      setLastRefreshAt(Date.now());
      setError(null);
      if (typeof console !== 'undefined') {
        console.info('[usePermissionEventsSSE] refreshed, new perm count:', newPermissions.length);
      }
    } catch (err) {
      // Network/timeout/5xx -> log warning, giu connection SSE de retry lan sau
      if (typeof console !== 'undefined') {
        console.warn('[usePermissionEventsSSE] refresh failed:', err && err.message);
      }
      setError(err && err.message);
    } finally {
      setRefreshing(false);
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return undefined;
    }

    let isCancelled = false;

    // Lang nghe logout: dong SSE va huy refresh dang chay de khong gay
    // them 401 sau khi user da clear session.
    const onLogout = () => {
      isCancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch { /* ignore */ }
        eventSourceRef.current = null;
      }
      setConnected(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(LOGOUT_KEY, onLogout);
    }

    const connect = () => {
      if (isCancelled) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const qs = tokenRef.current
        ? `?token=${encodeURIComponent(tokenRef.current)}`
        : '';
      const url = `${API_BASE_URL}/sse/permissions${qs}`;

      try {
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
          if (isCancelled) return;
          setConnected(true);
          setError(null);
          // Reset fail counter khi SSE ket noi thanh cong
          authFailCountRef.current = 0;
        });

        es.addEventListener('permission-changed', (e) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            // Callback cho UI (VD: hien toast). Van goi callback de UI
            // hien "da cap nhat" toast (admin muon biet BE da nhan save).
            try {
              onEventRef.current && onEventRef.current(data);
            } catch (cbErr) {
              console.warn('[usePermissionEventsSSE] onPermissionChanged threw:', cbErr);
            }
            // Neu chinh admin vua SELF_LU matrix (co skip flag), KHONG
            // refresh permissions: admin da biet permission moi va state
            // FE da duoc cap nhat qua response API. Refresh chi gay them
            // 1 round-trip + co the 403 neu token cu dang in-flight.
            if (consumeSkipNextPermissionChange()) {
              return;
            }
            // Refresh permission ngay (co cooldown/in-flight check ben trong).
            refreshPermissions();
          } catch (parseErr) {
            console.warn('[usePermissionEventsSSE] parse event failed:', parseErr);
          }
        });

        // Native error handler - reconnect (tru auth fail).
        // EventSource khong expose status code, nhung:
        // - neu server dong ngay lap tuc (< 1s sau khi connect) -> 401 (token invalid)
        // - neu reconnect lap lai lien tuc -> 401
        // Chung ta dung 'authFailCount' de phat hien pattern nay.
        es.onerror = () => {
          if (isCancelled) return;
          setConnected(false);
          authFailCountRef.current += 1;
          // Neu da fail >= 2 lan lien tiep -> co the la auth fail, thu refresh
          // token truoc khi reconnect (fix: SSE kem voi token stale khi BE
          // da invalidate JWT qua trackLogin).
          if (authFailCountRef.current >= 2) {
            // Close connection cu, refresh token, sau do reconnect
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            // Refresh async, sau do goi connect() voi token moi
            refreshPermissions().finally(() => {
              authFailCountRef.current = 0;
              if (!isCancelled) connect();
            });
            return;
          }
          // Neu server da dong connection ngay (401) -> khong reconnect ngay
          if (es.readyState === EventSource.CLOSED) {
            setError('SSE connection closed (auth?)');
            return;
          }
          // Network/5xx -> reconnect sau 5s
          reconnectTimerRef.current = setTimeout(() => {
            if (!isCancelled) connect();
          }, SSE_RECONNECT_DELAY_MS);
        };
      } catch (err) {
        if (isCancelled) return;
        console.warn('[usePermissionEventsSSE] EventSource failed:', err);
        setError(err && err.message);
        reconnectTimerRef.current = setTimeout(() => {
          if (!isCancelled) connect();
        }, SSE_RECONNECT_DELAY_MS);
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOGOUT_KEY, onLogout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token]);

  return { connected, refreshing, lastRefreshAt, error };
}

export default usePermissionEventsSSE;
