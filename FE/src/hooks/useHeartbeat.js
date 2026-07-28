import { useEffect, useRef, useState, useCallback } from 'react';
import { heartbeatApi, getServerTime } from '../services/authApi';
import { computeClockOffsetMs } from '../utils/dateUtils';
import { showSessionExpired, LOGOUT_KEY } from '../services/httpClient';

const HEARTBEAT_INTERVAL_MS = 60_000;      // 60s - khop voi throttle phia BE
const OFFSET_REFRESH_MS = 5 * 60_000;      // 5 phut refresh offset 1 lan
const BACKOFF_BASE_MS = 60_000;            // 60s backoff khi loi (set nho nhat)
const BACKOFF_MAX_MS = 5 * 60_000;         // 5 phut max backoff
const FIRST_HB_DELAY_MS = 5_000;           // Tick lan dau sau 5s (tranh spam luc mount)

/**
 * Hook goi /auth/heartbeat dinh ky de cap nhat last_activity_at phia BE.
 * Hook cung tinh clock offset (server - client) de FE hien thi gio chinh xac.
 *
 * CO CHE AN TOAN:
 * - Khi nhan 401 (token het han): backoff dang ke (60s -> 5phut) de tranh spam,
 *   chi goi SessionExpiredModal 1 LAN (khong phai 1 lan moi retry).
 * - Khi network fail / 5xx: backoff nhe, tiep tuc thu.
 * - Khi 200 OK: reset backoff ve 0.
 *
 * @param {object} options
 * @param {boolean} options.enabled - mac dinh true
 * @param {number} options.intervalMs - mac dinh 60s
 * @returns {{ clockOffsetMs: number, lastServerTimeIso: string|null, lastHeartbeatAt: number|null }}
 */
export function useHeartbeat(options = {}) {
  const { enabled = true, intervalMs = HEARTBEAT_INTERVAL_MS } = options;
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [lastServerTimeIso, setLastServerTimeIso] = useState(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);

  // Backoff multiplier (tang gap doi khi loi, reset khi OK)
  const backoffRef = useRef(0);
  const sessionExpiredFiredRef = useRef(false);

  const refreshOffset = useCallback(async () => {
    if (!enabled) return;
    const clientMs = Date.now();
    try {
      const data = await getServerTime();
      if (data && data.serverTime) {
        setClockOffsetMs(computeClockOffsetMs(data.serverTime, clientMs));
        setLastServerTimeIso(data.serverTime);
      }
    } catch {
      // Nuot loi, khong anh huong UI
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    let timeoutId = null;

    // Lang nghe logout de cleanup SOM (truoc khi React unmount). Neu khong
    // lang nghe, mot tick co the duoc len lich (setTimeout 60s) se FIRE ngay
    // sau khi user logout, goi API voi token = null -> 401 -> SessionExpiredModal.
    const onLogout = () => {
      stopped = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(LOGOUT_KEY, onLogout);
    }

    refreshOffset();
    const offsetTimer = setInterval(refreshOffset, OFFSET_REFRESH_MS);

    const tick = async () => {
      if (stopped) return;
      try {
        const result = await heartbeatApi();
        if (result?.unauthorized) {
          if (!sessionExpiredFiredRef.current) {
            sessionExpiredFiredRef.current = true;
            showSessionExpired({
              code: 'SESSION_REPLACED',
              message: 'Đã có người đăng nhập tài khoản của bạn. Vui lòng đăng nhập lại để tiếp tục.',
            });
          }
          backoffRef.current = Math.min(backoffRef.current + 1, 4);
        } else if (result && result.serverTime) {
          setLastServerTimeIso(result.serverTime);
          setLastHeartbeatAt(Date.now());
          backoffRef.current = 0; // Reset backoff khi thanh cong
          sessionExpiredFiredRef.current = false; // Reset flag
        }
      } catch (err) {
        if (stopped) return;
        // Nuot cac loi do-logout (AbortError tu cancelAllPendingRequests) de
        // khong hien SessionExpiredModal khong can thiet.
        if (err && (err.name === 'AbortError' || err.code === 'ABORTED' || err.code === 'LOGGED_OUT')) {
          return;
        }
        const status = err?.status;

        if (status === 401 || status === 403) {
          // Chi fire SessionExpiredModal 1 LAN de tranh spam modal.
          // Modal se navigate ve /login roi clearSession(),
          // AuthContext re-render -> HeartbeatRunner unmount.
          if (!sessionExpiredFiredRef.current) {
            sessionExpiredFiredRef.current = true;
            showSessionExpired();
          }
          // Van tiep backoff (phong tru hop user dong modal ma khong logout)
          backoffRef.current = Math.min(backoffRef.current + 1, 4);
        } else {
          // Network / 5xx: backoff nhe de tranh spam BE
          backoffRef.current = Math.min(backoffRef.current + 1, 4);
        }
      }

      if (stopped) return;
      // Tinh delay cho tick tiep theo
      const delay = intervalMs + backoffRef.current * BACKOFF_BASE_MS;
      const clampedDelay = Math.min(delay, intervalMs + BACKOFF_MAX_MS);
      timeoutId = setTimeout(tick, clampedDelay);
    };

    // Tick lan dau sau 5s (tranh spam ngay sau login)
    timeoutId = setTimeout(tick, FIRST_HB_DELAY_MS);

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(offsetTimer);
      backoffRef.current = 0;
      sessionExpiredFiredRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOGOUT_KEY, onLogout);
      }
    };
  }, [enabled, intervalMs, refreshOffset]);

  return { clockOffsetMs, lastServerTimeIso, lastHeartbeatAt };
}

/**
 * Helper: format mot gia tri Date/ISO theo clock offset tinh duoc tu useHeartbeat.
 */
export function applyClockOffset(value, clockOffsetMs) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + clockOffsetMs);
}
