/** Đồng bộ badge sidebar ↔ panel cảnh báo bảo mật (realtime trong tab). */

export const SECURITY_ALERTS_COUNT_EVENT = 'security-alerts-count-changed';

/**
 * @param {number|object} totalOrCounts - tổng số, hoặc object { total, critical, ... }
 */
export function emitSecurityAlertsCount(totalOrCounts) {
  if (typeof window === 'undefined') return;
  const total =
    typeof totalOrCounts === 'number'
      ? totalOrCounts
      : Number(totalOrCounts?.total) || 0;
  const detail =
    typeof totalOrCounts === 'object' && totalOrCounts
      ? { ...totalOrCounts, total }
      : { total };
  window.dispatchEvent(new CustomEvent(SECURITY_ALERTS_COUNT_EVENT, { detail }));
}
