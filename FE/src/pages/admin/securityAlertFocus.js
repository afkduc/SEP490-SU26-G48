/**
 * Helpers: map security alert → filter seed cho tab Thiết bị / Lịch sử.
 *
 * Mục tiêu: admin bấm từ cảnh báo phải thấy đúng thiết bị + lịch sử
 * của tài khoản (hoặc của IP nếu cảnh báo không gắn user).
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
  new_device_ip: 'IP/thiết bị mới',
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
 * Seed lọc danh sách thiết bị từ 1 cảnh báo.
 *
 * - Có userId: lọc CHÍNH XÁC theo userId (không kèm displayName — tránh AND search làm rỗng kết quả).
 * - failed_login_burst: lọc theo IP.
 * - new_device_ip: userId + ưu tiên search IP để nổi thiết bị nghi vấn.
 */
export function buildDeviceSeedFromAlert(alert) {
  if (!alert) return null;
  const meta = parseAlertMeta(alert.metadata);
  const ip = String(meta.ipAddress || meta.ip || '').trim();
  const userName = String(alert.userName || meta.userName || '').trim();
  const rule = alert.ruleKey || '';

  if (rule === 'failed_login_burst') {
    return {
      userId: null,
      search: ip,
      isCurrent: '',
      context: describeAlertFocus(alert),
    };
  }

  if (rule === 'new_device_ip') {
    return {
      userId: alert.userId || null,
      // Chỉ search IP khi có — không dùng displayName
      search: ip || userName,
      isCurrent: '',
      context: describeAlertFocus(alert),
    };
  }

  // inactive_admin / new_admin_role / mặc định: toàn bộ thiết bị của tài khoản
  return {
    userId: alert.userId || null,
    // Không set search khi đã có userId — tránh LIKE displayName làm mất kết quả
    search: alert.userId ? '' : userName,
    isCurrent: '',
    context: describeAlertFocus(alert),
  };
}

/**
 * Seed lọc lịch sử đăng nhập từ 1 cảnh báo.
 *
 * - Cảnh báo gắn tài khoản: TOÀN BỘ lịch sử của user (không cắt ngày).
 * - failed_login_burst: theo IP + LOGIN_FAILED quanh thời điểm cảnh báo.
 * - new_device_ip: toàn bộ lịch sử user (có thể kèm IP để hẹp hơn nếu cần — mặc định full account).
 */
export function buildSessionSeedFromAlert(alert) {
  if (!alert) return null;
  const meta = parseAlertMeta(alert.metadata);
  const ip = String(meta.ipAddress || meta.ip || '').trim();
  const userName = String(alert.userName || meta.userName || '').trim();
  const rule = alert.ruleKey || '';
  const createdAt = alert.createdAt ? new Date(alert.createdAt) : new Date();

  // Brute-force theo IP — không có user: lọc đúng vấn đề thông báo
  if (rule === 'failed_login_burst') {
    const anchor = createdAt;
    return {
      userName: '',
      ipAddress: ip,
      startDate: toYmd(addDays(anchor, -1)),
      endDate: toYmd(addDays(anchor, 1)),
      actionType: 'LOGIN_FAILED',
      context: describeAlertFocus(alert),
    };
  }

  // Cảnh báo gắn tài khoản → toàn bộ lịch sử đăng nhập của user đó
  return {
    userName,
    ipAddress: '',
    startDate: '',
    endDate: '',
    actionType: '',
    context: describeAlertFocus(alert),
  };
}
