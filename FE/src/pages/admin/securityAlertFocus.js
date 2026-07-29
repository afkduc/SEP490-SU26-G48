/**
 * Helpers: map security alert → filter seed cho tab Lịch sử.
 *
 * Mục tiêu: admin bấm từ cảnh báo phải nhảy tới đúng phiên đăng nhập
 * tại thời điểm cảnh báo (IP / sessionId / khoảng ngày).
 */

export function parseAlertMeta(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

function toYmd(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(value, days) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

const RULE_LABEL = {
  failed_login_burst: 'Đăng nhập sai liên tiếp',
  new_admin_role: 'Gán quyền Admin',
  inactive_admin: 'Admin không hoạt động',
  session_takeover: 'Đăng nhập trên thiết bị khác',
};

/**
 * Nhãn ngắn để hiện banner ngữ cảnh sau khi nhảy từ cảnh báo.
 */
export function describeAlertFocus(alert) {
  if (!alert) return '';
  const meta = parseAlertMeta(alert.metadata);
  const who = alert.userName || meta.userName || alert.displayName || (alert.userId ? `#${alert.userId}` : '');
  const ip = meta.ipAddress || meta.ip || '';
  const rule = RULE_LABEL[alert.ruleKey] || alert.title || alert.ruleKey || 'Cảnh báo';
  if (who && ip) return `${rule} · ${who} · IP ${ip}`;
  if (who) return `${rule} · ${who}`;
  if (ip) return `${rule} · IP ${ip}`;
  return rule;
}

/**
 * Seed lọc lịch sử đăng nhập từ 1 cảnh báo + id phiên để highlight.
 *
 * - new_device_ip: user + IP + ngày quanh loginTime, focus theo sessionId nếu có
 * - failed_login_burst: IP + LOGIN_FAILED quanh thời điểm cảnh báo
 * - còn lại: lịch sử theo user (không cắt ngày)
 */
export function buildSessionSeedFromAlert(alert) {
  if (!alert) return null;
  const meta = parseAlertMeta(alert.metadata);
  const ip = String(meta.ipAddress || meta.ip || '').trim();
  const userName = String(alert.userName || meta.userName || '').trim();
  const rule = alert.ruleKey || '';
  const createdAt = alert.createdAt ? new Date(alert.createdAt) : new Date();
  const sessionId = meta.sessionId != null && meta.sessionId !== ''
    ? Number(meta.sessionId)
    : null;
  const loginTime = meta.loginTime ? String(meta.loginTime) : '';

  // Có sessionId → ưu tiên đúng 1 phiên; vẫn giữ user/IP để modal fallback nếu id lệch
  if (Number.isFinite(sessionId) && sessionId > 0) {
    return {
      userName: rule === 'session_takeover' ? userName : '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      actionType: '',
      sessionId,
      focusSessionId: sessionId,
      focusIp: ip,
      focusLoginTime: loginTime || (alert.createdAt ? String(alert.createdAt) : ''),
      context: describeAlertFocus(alert),
    };
  }

  if (rule === 'session_takeover') {
    const anchor = createdAt;
    return {
      userName,
      ipAddress: ip,
      startDate: toYmd(addDays(anchor, -1)),
      endDate: toYmd(addDays(anchor, 1)),
      actionType: 'LOGIN',
      sessionId: null,
      focusSessionId: null,
      focusIp: ip,
      focusLoginTime: alert.createdAt ? String(alert.createdAt) : '',
      context: describeAlertFocus(alert),
    };
  }

  if (rule === 'failed_login_burst') {
    const anchor = createdAt;
    return {
      userName: '',
      ipAddress: ip,
      startDate: toYmd(addDays(anchor, -1)),
      endDate: toYmd(addDays(anchor, 1)),
      actionType: 'LOGIN_FAILED',
      sessionId: null,
      focusSessionId: null,
      focusIp: ip,
      focusLoginTime: alert.createdAt ? String(alert.createdAt) : '',
      context: describeAlertFocus(alert),
    };
  }

  if (rule === 'new_device_ip') {
    const anchor = meta.loginTime ? new Date(meta.loginTime) : createdAt;
    return {
      userName,
      ipAddress: ip,
      startDate: toYmd(addDays(anchor, -1)),
      endDate: toYmd(addDays(anchor, 1)),
      actionType: '',
      sessionId: null,
      focusSessionId: null,
      focusIp: ip,
      focusLoginTime: loginTime || (alert.createdAt ? String(alert.createdAt) : ''),
      context: describeAlertFocus(alert),
    };
  }

  return {
    userName,
    ipAddress: '',
    startDate: '',
    endDate: '',
    actionType: '',
    sessionId: null,
    focusSessionId: null,
    focusIp: '',
    focusLoginTime: '',
    context: describeAlertFocus(alert),
  };
}
