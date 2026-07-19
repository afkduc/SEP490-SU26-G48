import { useEffect, useRef, useState, useCallback } from 'react';
// Path tu src/hooks/ -> src/services/ la 1 cap (..), khong phai 2 cap (../..)
import { heartbeatApi, getServerTime } from '../services/authApi';
import { computeClockOffsetMs } from '../utils/dateUtils';

const HEARTBEAT_INTERVAL_MS = 60_000;      // 60s - khop voi throttle phia BE
const OFFSET_REFRESH_MS = 5 * 60_000;      // 5 phut refresh offset 1 lan
const SERVER_TIME_TIMEOUT_MS = 4000;

/**
 * Hook goi /auth/heartbeat dinh ky de cap nhat last_activity_at phia BE.
 * Hook cung tinh clock offset (server - client) de FE hien thi gio chinh xac
 * khi may client set gio sai.
 *
 * Hook chi hoat dong khi user da dang nhap (token con trong localStorage).
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
  const offsetTimerRef = useRef(null);

  // Lay offset luc mount
  const refreshOffset = useCallback(async () => {
    if (!enabled) return;
    const clientMs = Date.now();
    try {
      const data = await getServerTime();
      if (data && data.serverTime) {
        const offset = computeClockOffsetMs(data.serverTime, clientMs);
        setClockOffsetMs(offset);
        setLastServerTimeIso(data.serverTime);
      }
    } catch {
      // Nuot loi, khong anh huong UI
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    // Lay offset lan dau
    refreshOffset();
    // Refresh offset dinh ky (5 phut)
    offsetTimerRef.current = setInterval(refreshOffset, OFFSET_REFRESH_MS);

    // Heartbeat dinh ky
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const result = await heartbeatApi();
      if (result && result.serverTime) {
        setLastServerTimeIso(result.serverTime);
        setLastHeartbeatAt(Date.now());
      }
    };
    const heartbeatTimer = setInterval(tick, intervalMs);
    // Tick lan dau sau 5s de khong spam luc mount
    const firstTick = setTimeout(tick, 5000);

    return () => {
      stopped = true;
      clearInterval(heartbeatTimer);
      clearTimeout(firstTick);
      if (offsetTimerRef.current) clearInterval(offsetTimerRef.current);
    };
  }, [enabled, intervalMs, refreshOffset]);

  return { clockOffsetMs, lastServerTimeIso, lastHeartbeatAt };
}

/**
 * Helper: format mot gia tri Date/ISO theo clock offset tinh duoc tu useHeartbeat.
 * Su dung khi FE muon hien thi "X phut truoc" hoac "tuong lai" voi clock that cua server.
 *
 * @param {string|Date} value
 * @param {number} clockOffsetMs
 * @returns {Date|null}
 */
export function applyClockOffset(value, clockOffsetMs) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + clockOffsetMs);
}