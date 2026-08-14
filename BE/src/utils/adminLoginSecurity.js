/**
 * Helpers: map security alert → filter seed cho tab Lịch sử / Thiết bị.
 * (Port từ FE securityAlertFocus — dùng chung cho unit test Report 5.1)
 */

function parseAlertMeta(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

const RULE_LABEL = {
  failed_login_burst: 'Đăng nhập sai liên tiếp',
  new_admin_role: 'Gán quyền Admin',
  inactive_admin: 'Admin không hoạt động',
  session_takeover: 'Đăng nhập trên thiết bị khác',
  new_device_ip: 'Đăng nhập từ thiết bị mới',
};

function describeAlertFocus(alert) {
  if (!alert) return '';
  const meta = parseAlertMeta(alert.metadata);
  const who =
    alert.userName ||
    meta.userName ||
    alert.displayName ||
    (alert.userId ? `#${alert.userId}` : '');
  const ip = meta.ipAddress || meta.ip || '';
  const rule = RULE_LABEL[alert.ruleKey] || alert.title || alert.ruleKey || 'Cảnh báo';
  if (who && ip) return `${rule} · ${who} · IP ${ip}`;
  if (who) return `${rule} · ${who}`;
  if (ip) return `${rule} · IP ${ip}`;
  return rule;
}

function buildSessionSeedFromAlert(alert) {
  if (!alert) return null;
  const meta = parseAlertMeta(alert.metadata);
  const ip = String(meta.ipAddress || meta.ip || '').trim();
  const userName = String(alert.userName || meta.userName || '').trim();
  const rule = alert.ruleKey || '';
  const context = describeAlertFocus(alert);

  const base = {
    sessionId: null,
    focusSessionId: null,
    focusIp: ip,
    focusLoginTime: '',
    preferLatest: true,
    context,
  };

  if (rule === 'session_takeover') {
    return {
      ...base,
      userName,
      ipAddress: '',
      startDate: '',
      endDate: '',
      actionType: 'LOGIN',
    };
  }

  if (rule === 'failed_login_burst') {
    return {
      ...base,
      userName: '',
      ipAddress: ip,
      startDate: '',
      endDate: '',
      actionType: 'LOGIN_FAILED',
    };
  }

  if (rule === 'new_device_ip') {
    return {
      ...base,
      userName,
      ipAddress: ip,
      startDate: '',
      endDate: '',
      actionType: '',
    };
  }

  return {
    ...base,
    userName,
    ipAddress: '',
    startDate: '',
    endDate: '',
    actionType: '',
  };
}

function pickLatestSession(list, { ip = '' } = {}) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const ipNorm = String(ip || '').trim();
  const candidates = ipNorm
    ? list.filter((s) => String(s.ip_address || s.ipAddress || '').trim() === ipNorm)
    : list;
  const pool = candidates.length > 0 ? candidates : list;

  let best = null;
  let bestMs = -Infinity;
  let bestId = -Infinity;
  for (const s of pool) {
    const t = s.login_time || s.loginTime || s.createdAt;
    const ms = t ? new Date(t).getTime() : NaN;
    const id = Number(s.id) || 0;
    const score = Number.isNaN(ms) ? 0 : ms;
    if (score > bestMs || (score === bestMs && id > bestId)) {
      bestMs = score;
      bestId = id;
      best = s;
    }
  }
  return best;
}

function pickLatestDevice(list, { ip = '' } = {}) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const ipNorm = String(ip || '').trim();
  const candidates = ipNorm
    ? list.filter((d) => String(d.ipAddress || d.ip_address || '').trim() === ipNorm)
    : list;
  const pool = candidates.length > 0 ? candidates : list;

  const toMs = (v) => {
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
  };

  let best = null;
  let bestMs = -Infinity;
  let bestId = -Infinity;
  for (const d of pool) {
    const ms = Math.max(toMs(d.lastLoginAt), toMs(d.lastActivityAt), toMs(d.createdAt));
    const id = Number(d.id) || 0;
    if (ms > bestMs || (ms === bestMs && id > bestId)) {
      bestMs = ms;
      bestId = id;
      best = d;
    }
  }
  return best;
}

module.exports = {
  parseAlertMeta,
  describeAlertFocus,
  buildSessionSeedFromAlert,
  pickLatestSession,
  pickLatestDevice,
};
