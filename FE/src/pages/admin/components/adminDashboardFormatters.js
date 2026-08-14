import { getAuditActionLabel } from '../../../utils/auditDisplay';

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export const ACTION_COLORS = {
  CREATE: '#059669',
  UPDATE: '#4f46e5',
  DELETE: '#dc2626',
  LOGIN: '#0891b2',
  LOGIN_FAILED: '#ef4444',
  LOGOUT: '#6b7280',
  ASSIGN: '#7c3aed',
  REVOKE: '#d97706',
  CHANGE_PASSWORD: '#db2777',
  ACTIVE: '#10b981',
  INACTIVE: '#94a3b8',
  LOCKED: '#ef4444',
};

export function getActionColor(action) {
  if (!action) return '#6b7280';
  const upper = action.toUpperCase();
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return '#6b7280';
}

export function formatActionLabel(action) {
  if (!action) return null;
  // Chuan hoa: "TAO_MOI" / "create user" / "Change_Password" deu thanh "TAO MOI" / "CHANGE PASSWORD"
  const cleaned = String(action).replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ').toUpperCase();
  return cleaned || null;
}

export function getActionBadge(action) {
  const fallbackLabel = getAuditActionLabel(action) || 'Thao tác';
  if (!action) return { label: 'Thao tác', bg: '#f1f5f9', color: '#64748b' };

  const upper = String(action).toUpperCase();

  // Tao moi / Insert
  if (upper.includes('CREATE') || upper.includes('INSERT') || upper.includes('ADD')) {
    return { label: 'Tạo mới', bg: '#dcfce7', color: '#15803d' };
  }
  // Cap nhat / Edit
  if (
    upper.includes('UPDATE') ||
    upper.includes('EDIT') ||
    upper.includes('MODIFY') ||
    upper.includes('PATCH')
  ) {
    return { label: 'Cập nhật', bg: '#eef2ff', color: '#4338ca' };
  }
  // Vo hieu hoa / log DELETE cu (he thong khong con xoa cung)
  if (upper.includes('DELETE') || upper.includes('REMOVE')) {
    return { label: 'Vô hiệu hóa', bg: '#fee2e2', color: '#dc2626' };
  }
  // Dang nhap that bai
  if (
    upper.includes('LOGIN_FAILED') ||
    upper.includes('LOGINFAIL') ||
    upper.includes('LOGIN FAIL')
  ) {
    return { label: 'Đăng nhập thất bại', bg: '#fee2e2', color: '#dc2626' };
  }
  // Dang nhap / Dang xuat
  if (upper.includes('LOGOUT') || upper.includes('SIGNOUT')) {
    return { label: 'ĐĂNG XUẤT', bg: '#e0f2fe', color: '#0369a1' };
  }
  if (upper.includes('LOGIN')) {
    return { label: 'ĐĂNG NHẬP', bg: '#e0f2fe', color: '#0369a1' };
  }
  // Phan quyen
  if (upper.includes('ASSIGN') || upper.includes('GRANT')) {
    return { label: 'GÁN QUYỀN', bg: '#f3e8ff', color: '#7c3aed' };
  }
  if (upper.includes('REVOKE') || upper.includes('UNASSIGN')) {
    return { label: 'THU HỒI', bg: '#fef3c7', color: '#b45309' };
  }
  // Mat khau
  if (upper.includes('PASSWORD') || upper.includes('RESET_PASS')) {
    return { label: 'ĐỔI MK', bg: '#fce7f3', color: '#be185d' };
  }
  // Trang thai (active/lock/toggle)
  if (upper.includes('ACTIVATE') || upper.includes('ENABLE')) {
    return { label: 'KÍCH HOẠT', bg: '#dcfce7', color: '#15803d' };
  }
  if (upper.includes('DEACTIVATE') || upper.includes('DISABLE')) {
    return { label: 'NGỪNG HOẠT ĐỘNG', bg: '#f1f5f9', color: '#64748b' };
  }
  if (upper.includes('LOCK')) {
    return { label: 'KHÓA', bg: '#fee2e2', color: '#dc2626' };
  }
  if (upper.includes('UNLOCK')) {
    return { label: 'MỞ KHÓA', bg: '#dcfce7', color: '#15803d' };
  }
  if (upper.includes('TOGGLE') || upper.includes('SWITCH') || upper.includes('STATUS')) {
    return { label: 'ĐỔI TRẠNG THÁI', bg: '#eef2ff', color: '#4338ca' };
  }
  // Import / Export
  if (upper.includes('IMPORT')) {
    return { label: 'NHẬP', bg: '#dbeafe', color: '#1d4ed8' };
  }
  if (upper.includes('EXPORT')) {
    return { label: 'XUẤT', bg: '#dbeafe', color: '#1d4ed8' };
  }
  // Upload / Download
  if (upper.includes('UPLOAD')) {
    return { label: 'TẢI LÊN', bg: '#fef3c7', color: '#b45309' };
  }
  if (upper.includes('DOWNLOAD')) {
    return { label: 'TẢI XUỐNG', bg: '#fef3c7', color: '#b45309' };
  }
  // Approve / Reject
  if (upper.includes('APPROVE')) {
    return { label: 'DUYỆT', bg: '#dcfce7', color: '#15803d' };
  }
  if (upper.includes('REJECT')) {
    return { label: 'TỪ CHỐI', bg: '#fee2e2', color: '#dc2626' };
  }
  // Cancel / Complete
  if (upper.includes('CANCEL')) {
    return { label: 'HỦY', bg: '#fee2e2', color: '#dc2626' };
  }
  if (upper.includes('COMPLETE') || upper.includes('FINISH') || upper.includes('DONE')) {
    return { label: 'HOÀN TẤT', bg: '#dcfce7', color: '#15803d' };
  }
  // View / Read
  if (upper.includes('VIEW') || upper.includes('READ')) {
    return { label: 'XEM', bg: '#e0e7ff', color: '#4338ca' };
  }
  // Fallback: hien thi goc (viet hoa, thay _ -> space) thay vi "UNKNOWN"
  return { label: fallbackLabel, bg: '#f1f5f9', color: '#475569' };
}

export function getResponseBadge(status) {
  if (status == null || status === '' || Number(status) === 0) {
    return { label: 'Đã thực hiện', bg: '#dcfce7', color: '#15803d' };
  }
  if (status >= 200 && status < 300)
    return { label: 'Thành công', bg: '#dcfce7', color: '#15803d' };
  if (status >= 400 && status < 500)
    return { label: 'Lỗi yêu cầu', bg: '#fef3c7', color: '#b45309' };
  if (status >= 500) return { label: 'Lỗi hệ thống', bg: '#fee2e2', color: '#dc2626' };
  return { label: `HTTP ${status}`, bg: '#f1f5f9', color: '#475569' };
}

export function getStatusBadge(status) {
  if (!status) return { label: '—', bg: '#f1f5f9', color: '#64748b' };
  const upper = String(status).toUpperCase();
  if (upper === 'SUCCESS' || upper === 'ACTIVE')
    return { label: 'Đang hoạt động', bg: '#dcfce7', color: '#15803d' };
  if (upper === 'ENDED' || upper === 'LOGGED_OUT')
    return { label: 'Đã đăng xuất', bg: '#f1f5f9', color: '#64748b' };
  if (upper === 'FAILED' || upper === 'FAIL')
    return { label: 'Thất bại', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'LOCKED') return { label: 'Bị khóa', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'INACTIVE') return { label: 'Ngừng hoạt động', bg: '#f1f5f9', color: '#64748b' };
  return { label: status, bg: '#f1f5f9', color: '#475569' };
}

export function isAdminDarkTheme() {
  try {
    return (
      localStorage.getItem('admin-theme') === 'dark' ||
      !!document.querySelector('.admin-shell--dark')
    );
  } catch {
    return false;
  }
}

export function getAlertStyle(alert) {
  // Ưu tiên: severity (notification) > type (legacy) > action (audit)
  // create/login = xanh; sửa/cập nhật = vàng; ngừng/khóa/xóa = đỏ
  const raw = (alert.severity || alert.type || alert.action || alert.title || '').toLowerCase();
  const dark = isAdminDarkTheme();
  if (
    raw === 'success' ||
    raw.includes('create') ||
    raw.includes('login') ||
    raw.includes('tạo') ||
    raw.includes('đăng nhập')
  ) {
    return dark
      ? {
          bg: 'rgba(34,197,94,0.12)',
          border: '#166534',
          color: '#86efac',
          iconBg: 'rgba(34,197,94,0.22)',
        }
      : { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', iconBg: '#dcfce7' };
  }
  if (
    raw === 'danger' ||
    raw === 'error' ||
    raw === 'critical' ||
    raw.includes('disable') ||
    raw.includes('delete') ||
    raw.includes('reject') ||
    raw.includes('ngừng') ||
    raw.includes('khóa') ||
    raw.includes('vô hiệu')
  ) {
    return dark
      ? {
          bg: 'rgba(239,68,68,0.12)',
          border: '#991b1b',
          color: '#fca5a5',
          iconBg: 'rgba(239,68,68,0.22)',
        }
      : { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', iconBg: '#fee2e2' };
  }
  if (
    raw === 'warning' ||
    raw === 'info' ||
    raw.includes('update') ||
    raw.includes('cập nhật') ||
    raw.includes('sửa')
  ) {
    return dark
      ? {
          bg: 'rgba(245,158,11,0.12)',
          border: '#92400e',
          color: '#fcd34d',
          iconBg: 'rgba(245,158,11,0.22)',
        }
      : { bg: '#fffbeb', border: '#fde68a', color: '#d97706', iconBg: '#fef3c7' };
  }
  return dark
    ? { bg: '#162032', border: '#334155', color: '#cbd5e1', iconBg: '#1e293b' }
    : { bg: '#f8fafc', border: '#e2e8f0', color: '#475569', iconBg: '#f1f5f9' };
}

// Severity: danh gia muc do nghiem trong cua canh bao
export const SEVERITY_LABELS = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};
export const SEVERITY_STYLES = {
  critical: { label: 'Nghiêm trọng', bg: '#991b1b', color: '#ffffff' },
  high: { label: 'Cao', bg: '#dc2626', color: '#ffffff' },
  medium: { label: 'Trung bình', bg: '#eab308', color: '#1f2937' },
  low: { label: 'Thấp', bg: '#10b981', color: '#ffffff' },
  success: { label: 'Thành công', bg: '#16a34a', color: '#ffffff' },
  info: { label: 'Thông tin', bg: '#2563eb', color: '#ffffff' },
  warning: { label: 'Cảnh báo', bg: '#d97706', color: '#ffffff' },
  error: { label: 'Lỗi', bg: '#dc2626', color: '#ffffff' },
};

// Category: phan loai canh bao
export const CATEGORY_LABELS = {
  security: 'Bảo mật',
  user: 'Người dùng',
  system: 'Hệ thống',
  data: 'Dữ liệu',
  performance: 'Hiệu năng',
};

export function inferCategory(alert) {
  const haystack =
    `${alert?.title || ''} ${alert?.message || ''} ${alert?.affectedEntity || ''}`.toLowerCase();
  if (!haystack.trim()) return null;
  if (/(login|dang nhap|password|mat khau|lock|khoa|permission|quyen)/.test(haystack))
    return 'security';
  if (/(user|nguoi dung|account|tai khoan|role|vai tro)/.test(haystack)) return 'user';
  if (/(database|table|record|du lieu|data|backup)/.test(haystack)) return 'data';
  if (/(system|server|service|he thong|api|deploy)/.test(haystack)) return 'system';
  if (/(slow|latency|timeout|performance|hieu nang)/.test(haystack)) return 'performance';
  return 'system';
}

// Severity inference: du vao type va noi dung
export function inferSeverity(alert) {
  const s = alert.severity || alert.type || '';
  const sl = s.toLowerCase();
  if (sl === 'critical') return 'critical';
  if (sl === 'success') return 'low';
  if (sl === 'info') return 'low';
  if (sl === 'error') return 'high';
  if (sl === 'danger') return 'high';
  if (sl === 'warning') return 'medium';
  return 'low';
}

// Lay ten actor (nguoi gay ra canh bao) tu nhieu truong co the
export function resolveAlertActor(alert) {
  return (
    alert.actor ||
    alert.actorName ||
    alert.actor_name ||
    alert.user_name ||
    alert.userName ||
    (alert.targetName ? `bởi ${alert.targetName}` : null)
  );
}

export function buildActivityDetails(log) {
  const targetType = log.tableName || log.table_name || log.targetType;
  const targetCode = log.entityCode || log.entity_code;
  const oldVal = log.oldValue;
  const newVal = log.newValue;
  const recordId = log.recordId || log.record_id;

  const pieces = [];

  if (targetType) {
    const friendly = String(targetType).replace(/[_-]+/g, ' ').trim();
    pieces.push(targetCode ? `${friendly} ${targetCode}` : friendly);
  } else if (targetCode) {
    pieces.push(targetCode);
  }

  // Mo ta su thay doi (UPDATE) hoac noi dung (CREATE)
  const rawBody = oldVal || newVal;
  if (rawBody) {
    let label = null;
    try {
      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      if (parsed && typeof parsed === 'object') {
        // Lay 1-2 truong co thong tin nhat
        const candidates = ['name', 'userName', 'code', 'status', 'roleName', 'branchName'];
        for (const k of candidates) {
          if (parsed[k]) {
            label = String(parsed[k]);
            break;
          }
        }
        if (!label) {
          // Neu khong match, lay key value dau tien
          const firstKey = Object.keys(parsed)[0];
          if (firstKey) label = String(parsed[firstKey]);
        }
      } else {
        label = String(parsed);
      }
    } catch {
      label = String(rawBody).slice(0, 80);
    }
    if (label && label !== 'null') pieces.push(label);
  } else if (recordId && !targetCode) {
    pieces.push(`#${recordId}`);
  }

  return pieces.length > 0 ? pieces.join(' — ') : null;
}

// Sinh thong bao tu dong tu stats hien co, dam bao widget khong bao gio trong.
// Dung de fallback khi backend khong tra ve alerts (vi du DB chua co du lieu canh bao).
export function generateAlertsFromStats(stats) {
  if (!stats) return [];
  const out = [];
  const nowIso = new Date().toISOString();

  // 1. Tai khoan dang bi khoa
  if (stats.lockedUsers > 0) {
    out.push({
      id: 'auto-locked-users',
      type: 'warning',
      severity: 'high',
      category: 'security',
      icon: 'lock',
      title: 'Tài khoản đang bị khóa',
      message: `${stats.lockedUsers} tài khoản đang bị khóa, cần xem xét mở khóa hoặc xóa`,
      affectedEntity: 'users',
      time: nowIso,
    });
  }

  // 2. Canh bao khi co cum dang nhap that bai bat thuong trong 15 phut.
  // failedLogins la thong ke ca ngay; no khong dai dien cho phien hien tai.
  const failedBurstCount = stats.recentFailedLogins || 0;
  if (failedBurstCount >= 5) {
    const severity = failedBurstCount > 10 ? 'critical' : 'medium';
    const type = failedBurstCount > 10 ? 'danger' : 'warning';
    out.push({
      id: 'auto-failed-logins',
      type,
      severity,
      category: 'security',
      icon: 'alert',
      title: 'Nhiều lần đăng nhập thất bại',
      message: `${failedBurstCount} lần đăng nhập thất bại trong 15 phút qua${failedBurstCount > 10 ? ' - kiểm tra an ninh ngay' : ''}`,
      affectedEntity: 'auth',
      time: nowIso,
    });
  }

  // 3. Dang nhap thanh cong hom nay
  if (stats.todayLogins > 0) {
    out.push({
      id: 'auto-today-logins',
      type: 'info',
      severity: 'low',
      category: 'user',
      icon: 'user',
      title: 'Hoạt động đăng nhập',
      message: `${stats.todayLogins} lượt đăng nhập thành công trong ngày hôm nay`,
      affectedEntity: 'sessions',
      time: nowIso,
    });
  }

  // 4. Ti le ngung hoat dong cao
  if (stats.totalUsers > 0 && stats.inactiveUsers > stats.totalUsers * 0.3) {
    out.push({
      id: 'auto-inactive-ratio',
      type: 'warning',
      severity: 'medium',
      category: 'user',
      icon: 'user',
      title: 'Tỉ lệ tài khoản ngừng hoạt động cao',
      message: `${stats.inactiveUsers}/${stats.totalUsers} tài khoản đang ngừng hoạt động (>30%)`,
      affectedEntity: 'users',
      time: nowIso,
    });
  }

  // 5. Khong co du lieu audit_log
  if (!stats.recentLogs || stats.recentLogs.length === 0) {
    out.push({
      id: 'auto-no-audit',
      type: 'info',
      severity: 'low',
      category: 'data',
      icon: 'info',
      title: 'Chưa có nhật ký hoạt động',
      message: 'Hệ thống chưa ghi nhận audit log nào. Hãy thao tác trên hệ thống để tạo log',
      affectedEntity: 'audit_logs',
      time: nowIso,
    });
  }

  return out;
}

// Gop audit_logs + login_sessions thanh mot danh sach thoi gian thong nhat,
// dam bao widget nhat ky khong bao gio trong neu it nhat mot trong hai co du lieu.
// Gom trùng: cùng loại login (action+user+IP) / cùng audit gần giống → chỉ giữ bản mới nhất.
export function buildCombinedActivity(recentLogs, recentLogins) {
  const items = [];

  (recentLogs || []).forEach((log) => {
    items.push({
      kind: 'audit',
      id: `audit-${log.id}`,
      time: log.createdAt || log.logged_at,
      payload: log,
    });
  });

  (recentLogins || []).forEach((s) => {
    items.push({
      kind: 'login_session',
      id: `session-${s.id}`,
      time: s.loginTime || s.login_time || s.logoutTime || s.logout_time,
      payload: s,
    });
  });

  items.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });

  const seen = new Set();
  const collapsed = [];
  for (const item of items) {
    let key;
    if (item.kind === 'login_session') {
      const s = item.payload || {};
      key = `login:${s.actionType || s.action_type || ''}|${s.userName || s.user_name || ''}|${s.ipAddress || s.ip_address || ''}`;
    } else {
      const log = item.payload || {};
      key = `audit:${log.action || ''}|${log.actorName || log.user_name || ''}|${log.targetType || log.table_name || ''}|${log.targetId || log.record_id || ''}|${log.responseStatus ?? log.response_status ?? ''}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    collapsed.push(item);
  }

  return collapsed.slice(0, 10);
}

/** Gom thông báo/cảnh báo trùng trên widget Tổng quan (giống chuông). */
export const DASH_SPAM_PATTERNS = [
  {
    re: /đăng nhập trên thiết bị khác|đăng nhập thay phiên|đã có người đăng nhập tài khoản|session_takeover|SESSION_TAKEN_OVER|SECURITY_SESSION_TAKEOVER/i,
    key: 'session_takeover',
  },
  { re: /admin không hoạt động|inactive_admin|SECURITY_INACTIVE_ADMIN/i, key: 'inactive_admin' },
  { re: /đăng nhập từ ip mới|new_device|SECURITY_NEW_DEVICE_IP|NEW_DEVICE/i, key: 'new_device_ip' },
  {
    re: /nhiều lần đăng nhập thất bại|failed_login|SECURITY_FAILED_LOGIN_BURST/i,
    key: 'failed_login_burst',
  },
];

export function dashAlertCollapseKey(item) {
  const rule = item.ruleKey || item.rule_key || item.metadata?.ruleKey;
  const uid = item.userId || item.metadata?.relatedUserId || item.metadata?.userId || 0;
  if (rule) return `rule:${rule}:${uid}`;

  const type = item.notifType || item.metadata?.eventType || '';
  const title = String(item.title || '');
  const hay = `${type} ${title}`;
  for (const { re, key } of DASH_SPAM_PATTERNS) {
    if (re.test(hay)) return `rule:${key}:${uid}`;
  }
  if (type) return `type:${type}`;
  return `id:${item.id}`;
}

export function collapseDashboardAlerts(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = dashAlertCollapseKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
