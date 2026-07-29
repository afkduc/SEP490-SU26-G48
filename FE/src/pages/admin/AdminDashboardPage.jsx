import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getAdminDashboardStats, adminSecurityAlertsApi } from '../../services/adminApi';
import { getNotifications } from '../../services/notificationApi';
import { humanizeNotificationMessage } from '../../utils/notificationDisplay';
import { humanizeAuditDescription, getAuditActionLabel } from '../../utils/auditDisplay';
import { SECURITY_ALERTS_COUNT_EVENT } from '../../utils/securityAlertEvents';
import './AdminDashboardPage.css';

// ─── Icons ──────────────────────────────────────────────────────────────────

const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconBranch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconRole = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconLogin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconLog = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconActivity = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const IconTerminal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

function formatRelativeTime(dateStr) {
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

function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

const ACTION_COLORS = {
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

function getActionColor(action) {
  if (!action) return '#6b7280';
  const upper = action.toUpperCase();
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return '#6b7280';
}

function formatActionLabel(action) {
  if (!action) return null;
  // Chuan hoa: "TAO_MOI" / "create user" / "Change_Password" deu thanh "TAO MOI" / "CHANGE PASSWORD"
  const cleaned = String(action)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  return cleaned || null;
}

function getActionBadge(action) {
  const fallbackLabel = getAuditActionLabel(action) || 'Thao tác';
  if (!action) return { label: 'Thao tác', bg: '#f1f5f9', color: '#64748b' };

  const upper = String(action).toUpperCase();

  // Tao moi / Insert
  if (upper.includes('CREATE') || upper.includes('INSERT') || upper.includes('ADD')) {
    return { label: 'Tạo mới', bg: '#dcfce7', color: '#15803d' };
  }
  // Cap nhat / Edit
  if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('MODIFY') || upper.includes('PATCH')) {
    return { label: 'Cập nhật', bg: '#eef2ff', color: '#4338ca' };
  }
  // Xoa
  if (upper.includes('DELETE') || upper.includes('REMOVE')) {
    return { label: 'Xóa', bg: '#fee2e2', color: '#dc2626' };
  }
  // Dang nhap that bai
  if (upper.includes('LOGIN_FAILED') || upper.includes('LOGINFAIL') || upper.includes('LOGIN FAIL')) {
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

function getResponseBadge(status) {
  if (status == null) return null;
  if (status >= 200 && status < 300) return { label: status, bg: '#dcfce7', color: '#15803d' };
  if (status >= 400 && status < 500) return { label: status, bg: '#fef3c7', color: '#b45309' };
  if (status >= 500) return { label: status, bg: '#fee2e2', color: '#dc2626' };
  return { label: status, bg: '#f1f5f9', color: '#475569' };
}

function getStatusBadge(status) {
  if (!status) return { label: '—', bg: '#f1f5f9', color: '#64748b' };
  const upper = status.toUpperCase();
  if (upper === 'SUCCESS' || upper === 'ACTIVE') return { label: 'Thành công', bg: '#dcfce7', color: '#15803d' };
  if (upper === 'FAILED' || upper === 'FAIL') return { label: 'Thất bại', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'LOCKED') return { label: 'Bị khóa', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'INACTIVE') return { label: 'Ngừng hoạt động', bg: '#f1f5f9', color: '#64748b' };
  return { label: status, bg: '#f1f5f9', color: '#475569' };
}

function getAlertIcon(iconType) {
  switch (iconType) {
    case 'lock': return <IconLock />;
    case 'alert': return <IconAlert />;
    case 'user': return <IconInfo />;
    default: return <IconInfo />;
  }
}

function isAdminDarkTheme() {
  try {
    return localStorage.getItem('admin-theme') === 'dark'
      || !!document.querySelector('.admin-shell--dark');
  } catch {
    return false;
  }
}

function getAlertStyle(alert) {
  // Ưu tiên: severity (notification) > type (legacy) > action (audit)
  // create/login = xanh; sửa/cập nhật = vàng; ngừng/khóa/xóa = đỏ
  const raw = (alert.severity || alert.type || alert.action || alert.title || '').toLowerCase();
  const dark = isAdminDarkTheme();
  if (
    raw === 'success'
    || raw.includes('create')
    || raw.includes('login')
    || raw.includes('tạo')
    || raw.includes('đăng nhập')
  ) {
    return dark
      ? { bg: 'rgba(34,197,94,0.12)', border: '#166534', color: '#86efac', iconBg: 'rgba(34,197,94,0.22)' }
      : { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', iconBg: '#dcfce7' };
  }
  if (
    raw === 'danger'
    || raw === 'error'
    || raw === 'critical'
    || raw.includes('disable')
    || raw.includes('delete')
    || raw.includes('reject')
    || raw.includes('ngừng')
    || raw.includes('khóa')
    || raw.includes('vô hiệu')
  ) {
    return dark
      ? { bg: 'rgba(239,68,68,0.12)', border: '#991b1b', color: '#fca5a5', iconBg: 'rgba(239,68,68,0.22)' }
      : { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', iconBg: '#fee2e2' };
  }
  if (
    raw === 'warning'
    || raw === 'info'
    || raw.includes('update')
    || raw.includes('cập nhật')
    || raw.includes('sửa')
  ) {
    return dark
      ? { bg: 'rgba(245,158,11,0.12)', border: '#92400e', color: '#fcd34d', iconBg: 'rgba(245,158,11,0.22)' }
      : { bg: '#fffbeb', border: '#fde68a', color: '#d97706', iconBg: '#fef3c7' };
  }
  return dark
    ? { bg: '#162032', border: '#334155', color: '#cbd5e1', iconBg: '#1e293b' }
    : { bg: '#f8fafc', border: '#e2e8f0', color: '#475569', iconBg: '#f1f5f9' };
}

// Severity: danh gia muc do nghiem trong cua canh bao
const SEVERITY_LABELS = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};
const SEVERITY_STYLES = {
  critical: { label: 'Nghiêm trọng', bg: '#991b1b', color: '#ffffff' },
  high:     { label: 'Cao',         bg: '#dc2626', color: '#ffffff' },
  medium:   { label: 'Trung bình',  bg: '#eab308', color: '#1f2937' },
  low:      { label: 'Thấp',        bg: '#10b981', color: '#ffffff' },
  success:  { label: 'Thành công',  bg: '#16a34a', color: '#ffffff' },
  info:     { label: 'Thông tin',   bg: '#2563eb', color: '#ffffff' },
  warning:  { label: 'Cảnh báo',    bg: '#d97706', color: '#ffffff' },
  error:    { label: 'Lỗi',         bg: '#dc2626', color: '#ffffff' },
};

// Category: phan loai canh bao
const CATEGORY_LABELS = {
  security: 'Bảo mật',
  user: 'Người dùng',
  system: 'Hệ thống',
  data: 'Dữ liệu',
  performance: 'Hiệu năng',
};

function StatCard({ icon, label, value, sub, accent, trend }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-card__icon-wrap">
        {icon}
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value ?? '—'}</div>
        <div className="stat-card__label">{label}</div>
        {sub && <div className="stat-card__sub">{sub}</div>}
        {trend !== undefined && (
          <div className={`stat-card__trend ${trend >= 0 ? 'trend--up' : 'trend--down'}`}>
            <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ dot, title, badge, link, linkLabel }) {
  return (
    <div className="section-header">
      <div className="section-header__left">
        <span className="section-header__dot" style={{ background: dot }} />
        <h2 className="section-header__title">{title}</h2>
        {badge !== undefined && (
          <span className="section-header__badge">{badge}</span>
        )}
      </div>
      {link && (
        <Link to={link} className="section-header__link">
          {linkLabel || 'Xem tất cả'} <IconArrowRight />
        </Link>
      )}
    </div>
  );
}

// Phan loai category tu khoa xuat hien trong title/affectedEntity/message
function inferCategory(alert) {
  const haystack = `${alert?.title || ''} ${alert?.message || ''} ${alert?.affectedEntity || ''}`.toLowerCase();
  if (!haystack.trim()) return null;
  if (/(login|dang nhap|password|mat khau|lock|khoa|permission|quyen)/.test(haystack)) return 'security';
  if (/(user|nguoi dung|account|tai khoan|role|vai tro)/.test(haystack)) return 'user';
  if (/(database|table|record|du lieu|data|backup)/.test(haystack)) return 'data';
  if (/(system|server|service|he thong|api|deploy)/.test(haystack)) return 'system';
  if (/(slow|latency|timeout|performance|hieu nang)/.test(haystack)) return 'performance';
  return 'system';
}

// Severity inference: du vao type va noi dung
function inferSeverity(alert) {
  const s = alert.severity || alert.type || '';
  const sl = s.toLowerCase();
  if (sl === 'critical') return 'critical';
  if (sl === 'success') return 'low';
  if (sl === 'info')    return 'low';
  if (sl === 'error')  return 'high';
  if (sl === 'danger') return 'high';
  if (sl === 'warning') return 'medium';
  return 'low';
}

// Lay ten actor (nguoi gay ra canh bao) tu nhieu truong co the
function resolveAlertActor(alert) {
  return (
    alert.actor ||
    alert.actorName ||
    alert.actor_name ||
    alert.user_name ||
    alert.userName ||
    (alert.targetName ? `bởi ${alert.targetName}` : null)
  );
}

function AlertItem({ alert }) {
  const style = getAlertStyle(alert);
  const category = inferCategory(alert);
  const severity = inferSeverity(alert);
  const severityStyle = SEVERITY_STYLES[severity];
  const categoryLabel = category ? CATEGORY_LABELS[category] : null;

  // Fallback noi dung chinh: uu tien alert.message, neu trong thi dung title + affectedEntity
  const title = alert.title || 'Cảnh báo hệ thống';
  const message = humanizeNotificationMessage(
    alert.message ||
    alert.description ||
    (alert.affectedEntity ? `Liên quan đến ${alert.affectedEntity}` : null),
    alert.metadata || {
      targetCode: alert.affectedEntity,
      targetName: alert.targetName,
      actorName: alert.actorName,
    },
  );

  const actor = resolveAlertActor(alert);

  return (
    <div
      className="alert-item"
      style={{
        background: style.bg,
        borderColor: style.border,
        '--alert-accent': style.color,
      }}
    >
      <div className="alert-item__icon" style={{ background: style.iconBg, color: style.color }}>
        {getAlertIcon(alert.icon)}
      </div>
      <div className="alert-item__content">
        <div className="alert-item__header">
          <div className="alert-item__title" style={{ color: style.color }}>{title}</div>
          {severityStyle && (
            <span
              className="alert-item__severity"
              style={{ background: severityStyle.bg, color: severityStyle.color }}
              title={SEVERITY_LABELS[severity] || severity}
            >
              {severityStyle.label}
            </span>
          )}
        </div>
        {message && <div className="alert-item__message">{message}</div>}
        <div className="alert-item__meta">
          {categoryLabel && (
            <span className="alert-item__chip">{categoryLabel}</span>
          )}
          {alert.affectedEntity && (
            <span className="alert-item__chip alert-item__chip--mono">
              {alert.affectedEntity}
            </span>
          )}
          {actor && (
            <span className="alert-item__chip">Bởi: {actor}</span>
          )}
        </div>
      </div>
      <div className="alert-item__time">
        <div className="alert-item__time-rel">{formatRelativeTime(alert.time)}</div>
        {alert.time && (
          <div className="alert-item__time-abs">{formatDateTime(alert.time)}</div>
        )}
      </div>
    </div>
  );
}

// Tao noi dung mo ta chi tiet tu data co san khi backend khong tra "details" / "description".
function buildActivityDetails(log) {
  const targetType = log.tableName || log.table_name || log.targetType;
  const targetCode = log.entityCode || log.entity_code;
  const oldVal = log.oldValue;
  const newVal = log.newValue;
  const recordId = log.recordId || log.record_id;

  const pieces = [];

  if (targetType) {
    const friendly = String(targetType)
      .replace(/[_-]+/g, ' ')
      .trim();
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
function generateAlertsFromStats(stats) {
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
  if (
    stats.totalUsers > 0 &&
    stats.inactiveUsers > stats.totalUsers * 0.3
  ) {
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
function buildCombinedActivity(recentLogs, recentLogins) {
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
const DASH_SPAM_PATTERNS = [
  { re: /đăng nhập trên thiết bị khác|đăng nhập thay phiên|đã có người đăng nhập tài khoản|session_takeover|SESSION_TAKEN_OVER|SECURITY_SESSION_TAKEOVER/i, key: 'session_takeover' },
  { re: /admin không hoạt động|inactive_admin|SECURITY_INACTIVE_ADMIN/i, key: 'inactive_admin' },
  { re: /đăng nhập từ ip mới|new_device|SECURITY_NEW_DEVICE_IP|NEW_DEVICE/i, key: 'new_device_ip' },
  { re: /nhiều lần đăng nhập thất bại|failed_login|SECURITY_FAILED_LOGIN_BURST/i, key: 'failed_login_burst' },
];

function dashAlertCollapseKey(item) {
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

function collapseDashboardAlerts(list) {
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

function ActivityItem({ log }) {
  const badge = getActionBadge(log.action);
  const respBadge = getResponseBadge(log.responseStatus ?? log.response_status);

  // Lay ten actor voi fallback an toan
  const actor =
    log.actorName || log.user_name || log.userName || log.actor || 'Hệ thống';

  const details =
    humanizeAuditDescription(
      log.details || log.description,
      log.action,
      log.new_value || log.newValue,
    ) ||
    buildActivityDetails(log) ||
    (log.ipAddress || log.ip_address ? `Từ IP ${log.ipAddress || log.ip_address}` : null);

  return (
    <div className="activity-item">
      <div className="activity-item__bar" style={{ background: badge.color }} />
      <div className="activity-item__body">
        <div className="activity-item__top">
          <span className="activity-item__badge" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
          <span className="activity-item__actor">{actor}</span>
          {respBadge && (
            <span
              className="activity-item__status"
              style={{ background: respBadge.bg, color: respBadge.color }}
            >
              {respBadge.label}
            </span>
          )}
          {log.requestMethod && (
            <span className="activity-item__method">{log.requestMethod}</span>
          )}
        </div>

        {details && <div className="activity-item__details">{details}</div>}

        <div className="activity-item__meta">
          {(log.tableName || log.table_name) && (
            <span className="activity-item__meta-item activity-item__meta-item--strong">
              <IconTerminal />
              <span>{log.tableName || log.table_name}</span>
            </span>
          )}
          {(log.entityCode || log.entity_code) && (
            <span className="activity-item__meta-item activity-item__meta-item--code">
              {log.entityCode || log.entity_code}
            </span>
          )}
          {!log.entityCode && !log.entity_code && (log.recordId ?? log.record_id) != null && (
            <span className="activity-item__meta-item activity-item__meta-item--code">
              #{log.recordId ?? log.record_id}
            </span>
          )}
          {log.ipAddress && (
            <span className="activity-item__meta-item">
              <IconGlobe /> {log.ipAddress}
            </span>
          )}
          {log.durationMs != null && (
            <span className="activity-item__meta-item">
              <IconClock /> {log.durationMs}ms
            </span>
          )}
          <span className="activity-item__meta-item">
            <IconCalendar /> {formatDateTime(log.createdAt || log.logged_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LoginItem({ item }) {
  const statusBadge = getStatusBadge(item.status);
  const actionBadge = getActionBadge(item.actionType);

  // Fallback thong minh: uu tien userName > phone > userId > email > "Nguoi dung #id"
  const displayName =
    item.userName ||
    item.user_name ||
    (item.phoneNumber || item.phone_number
      ? `SDT: ${item.phoneNumber || item.phone_number}`
      : null) ||
    (item.email ? item.email : null) ||
    (item.userId || item.user_id
      ? `Người dùng #${item.userId || item.user_id}`
      : 'Người dùng');

  // Color cho status dot (xanh = active/thanh cong, do = fail, xam = ended)
  const loginStatusDot = (() => {
    if (item.actionType === 'LOGIN_FAILED' || item.status === 'failed') return '#ef4444';
    if (item.status === 'ended' || item.logoutTime || item.logout_time) return '#94a3b8';
    return '#10b981';
  })();

  return (
    <div className="login-item">
      <div
        className="login-item__avatar"
        style={{
          background: actionBadge.color + '20',
          color: actionBadge.color,
          '--login-status-dot': loginStatusDot,
        }}
      >
        <IconLogin />
      </div>
      <div className="login-item__body">
        <div className="login-item__top">
          <span className="login-item__user">{displayName}</span>
          <span className="login-item__status" style={{ background: statusBadge.bg, color: statusBadge.color }}>
            {statusBadge.label}
          </span>
        </div>
        <div className="login-item__meta">
          <span><IconGlobe /> {item.ipAddress || item.ip_address || '—'}</span>
          <span><IconClock /> {formatDateTime(item.loginTime || item.login_time)}</span>
          {(item.sessionDuration || item.session_duration_seconds) > 0 && (
            <span><IconCalendar /> {formatDuration(item.sessionDuration || item.session_duration_seconds)}</span>
          )}
          {(item.phoneNumber || item.phone_number) && item.userName && (
            <span className="login-item__phone">{item.phoneNumber || item.phone_number}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label, desc, accent }) {
  return (
    <Link to={to} className="quick-action" style={{ '--qa-accent': accent }}>
      <div className="quick-action__icon">{icon}</div>
      <div className="quick-action__text">
        <span className="quick-action__label">{label}</span>
        <span className="quick-action__desc">{desc}</span>
      </div>
      <IconArrowRight />
    </Link>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { to: '/admin/users', icon: <IconUsers />, label: 'Quản lý người dùng', desc: 'Xem, chỉnh sửa & phân quyền', accent: '#4f46e5' },
  { to: '/admin/login-security', icon: <IconAlert />, label: 'Bảo mật đăng nhập', desc: 'Thiết bị + tín hiệu cảnh báo', accent: '#ef4444' },
  { to: '/admin/logs', icon: <IconLog />, label: 'Nhật ký hoạt động', desc: 'Lịch sử thao tác', accent: '#d97706' },
  { to: '/admin/catalog', icon: <IconLogin />, label: 'Danh mục hệ thống', desc: 'Chi nhánh · Chuyên môn · Hãng xe', accent: '#0891b2' },
  { to: '/admin/profile', icon: <IconTerminal />, label: 'Tài khoản của tôi', desc: 'Hồ sơ & thông báo', accent: '#db2777' },
];

export default function AdminDashboardPage() {
  const { user, permissions } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const statsData = await getAdminDashboardStats();
        if (cancelled) return;
        setStats(statsData);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'AbortError' || err?.code === 'ABORTED' || err?.code === 'LOGGED_OUT') {
          return;
        }
        setError(err.message || 'Không thể tải thống kê');
      } finally {
        // Luôn tắt spinner trên instance còn sống — tránh kẹt "Đang tải..." khi remount
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch notifications CRUD gan day (poll 60s de dashboard cap nhat realtime-like)
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const fetchNotifs = async () => {
      try {
        const data = await getNotifications({ pageSize: 20 });
        const items = data?.items || data || [];
        if (!cancelled) setNotifications(items);
      } catch (_) {
        // Silent fail
      }
    };

    fetchNotifs();
    intervalId = setInterval(fetchNotifs, 60_000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Đồng bộ số cảnh báo bảo mật (đã gom) — event từ panel + poll ngắn
  useEffect(() => {
    let cancelled = false;

    const applyCounts = (counts) => {
      if (cancelled || !counts) return;
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alertCounts: {
            total: Number(counts.total) || 0,
            critical: Number(counts.critical) || 0,
            high: Number(counts.high) || 0,
            medium: Number(counts.medium) || 0,
            info: Number(counts.info) || 0,
          },
        };
      });
    };

    const refreshCounts = async () => {
      try {
        const counts = await adminSecurityAlertsApi.getCounts();
        applyCounts(counts);
      } catch (_) {
        // Silent
      }
    };

    refreshCounts();
    const intervalId = setInterval(refreshCounts, 30_000);

    const onCountEvent = (e) => {
      const detail = e?.detail;
      if (detail && typeof detail === 'object' && ('critical' in detail || 'high' in detail)) {
        applyCounts(detail);
      } else {
        refreshCounts();
      }
    };
    window.addEventListener(SECURITY_ALERTS_COUNT_EVENT, onCountEvent);
    const onFocus = () => refreshCounts();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener(SECURITY_ALERTS_COUNT_EVENT, onCountEvent);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Gop notifications CRUD + alerts tu backend + alerts tu sinh (auto) de widget luon co noi dung.
  // Hien thi notifications CRUD truoc (mau xanh/vang/do theo action), sau do security alerts.
  const derivedAlerts = (() => {
    if (!stats) return [];

    // 1. Notifications tu CRUD (mau phan biet theo severity)
    const notifItems = notifications.map((n) => ({
      id: `notif-${n.id}`,
      title: n.title,
      message: humanizeNotificationMessage(n.message, n.metadata),
      severity: n.severity || null,
      type: n.severity || 'info',
      notifType: n.type,
      time: n.createdAt || n.timestamp || n.created_at,
      actorName: n.metadata?.actorName || null,
      targetName: n.metadata?.targetName || null,
      affectedEntity: n.metadata?.targetCode || null,
      metadata: n.metadata,
      _source: 'notification',
    }));

    // 2. Security alerts — chỉ Critical/High trên widget Tổng quan
    const backendAlerts = (Array.isArray(stats.alerts) ? stats.alerts : [])
      .filter((a) => a.severity === 'critical' || a.severity === 'high')
      .map((a) => ({
        ...a,
        ruleKey: a.ruleKey || a.rule_key,
        userId: a.userId || a.user_id,
      }));

    // 3. Alerts tu sinh (auto) neu backend tra rong
    const autoAlerts = (backendAlerts.length === 0 && notifications.length === 0)
      ? generateAlertsFromStats(stats)
      : [];

    // Gop + sort theo thoi gian moi nhat + bỏ trùng (giống chuông)
    const all = [...notifItems, ...backendAlerts, ...autoAlerts];
    all.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });

    return collapseDashboardAlerts(all).slice(0, 12);
  })();

  // Gop nhat ky hoat dong voi login sessions, sort theo thoi gian moi nhat.
  const combinedActivity = stats ? buildCombinedActivity(
    stats.recentLogs || [],
    stats.recentLogins || [],
  ) : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <div className="admin-dashboard">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="dash-header">
        <div className="dash-header__left">
          <div className="dash-header__greeting">
            {greeting}, <span className="dash-header__name">{user?.name}</span>
          </div>
          <div className="dash-header__meta">
            <span className="dash-header__role">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Quản trị hệ thống
            </span>
            <span className="dash-header__email">{user?.email}</span>
            <span className="dash-header__date">{todayStr}</span>
          </div>
        </div>
        <div className="dash-header__right">
          <div className="dash-header__live-dot" />
          <span className="dash-header__live-label">Live</span>
          <span className="dash-header__update">
            Cập nhật: {stats?.generatedAt ? formatDateTime(stats.generatedAt) : '...'}
          </span>
        </div>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────── */}
      {loading && (
        <div className="dash-loading">
          <div className="dash-loading__spinner" />
          <span>Đang tải thống kê...</span>
        </div>
      )}
      {error && !loading && (
        <div className="dash-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────── */}
      {stats && !loading && (
        <>
          {/* ── Row 1: Stats cards ────────────────────────────── */}
          <div className="dash-stats-grid">
            <StatCard
              accent="#4f46e5"
              icon={<IconUsers />}
              label="Tổng người dùng"
              value={stats.totalUsers}
              sub={
                <span className="stat-chip-row">
                  <span className="stat-chip stat-chip--green">{stats.activeUsers} hoạt động</span>
                  <span className="stat-chip stat-chip--gray">{stats.inactiveUsers} ngừng</span>
                  {stats.lockedUsers > 0 && (
                    <span className="stat-chip stat-chip--red">{stats.lockedUsers} bị khóa</span>
                  )}
                </span>
              }
            />
            <StatCard
              accent="#059669"
              icon={<IconBranch />}
              label="Chi nhánh"
              value={stats.totalBranches}
              sub="Đang hoạt động"
            />
            <StatCard
              accent="#7c3aed"
              icon={<IconRole />}
              label="Vai trò"
              value={stats.totalRoles}
              sub="Vai trò hiện có"
            />
            <StatCard
              accent="#0891b2"
              icon={<IconLogin />}
              label="Đăng nhập hôm nay"
              value={stats.todayLogins}
              sub={`${stats.failedLogins} lần thất bại`}
            />
          </div>

          {/* Banner chỉ Critical/High — tránh ồn Info/Medium */}
          {(() => {
            const critical = Number(stats.alertCounts?.critical) || 0;
            const high = Number(stats.alertCounts?.high) || 0;
            const urgent = critical + high;
            if (urgent <= 0) return null;
            return (
              <Link to="/admin/login-security?alerts=1" className="dash-alert-banner">
                <IconAlert />
                <span>
                  Có{' '}
                  <strong>{urgent > 99 ? '99+' : urgent}</strong>
                  {' '}cảnh báo bảo mật cần xử lý
                  {' '}(Critical {critical} · High {high})
                </span>
                <span className="dash-alert-banner__link">Xem và xử lý <IconArrowRight /></span>
              </Link>
            );
          })()}

          {/* ── Row 2: Alerts + Logs widget ────────────────────── */}
          <div className="dash-row-2">
            {/* Alerts widget */}
            <div className="dash-widget">
              <SectionHeader
                dot="linear-gradient(135deg, #ef4444, #f97316)"
                title="Thông báo hệ thống"
                badge={derivedAlerts.length}
                link="/admin/login-security?alerts=1"
                linkLabel="Cảnh báo bảo mật"
              />
              <div className="dash-widget__body">
                {derivedAlerts.length > 0 ? (
                  derivedAlerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state__icon" style={{ color: '#10b981' }}>
                      <IconCheck />
                    </div>
                    <p>Tất cả hoạt động bình thường</p>
                  </div>
                )}
              </div>
            </div>

            {/* Logs widget - chi hien thi audit logs gan day */}
            <div className="dash-widget dash-widget--logs">
              <div className="dash-widget__topbar">
                <div className="dash-widget__title">
                  <IconLog />
                  <h2 className="dash-widget__heading">Nhật ký hoạt động gần đây</h2>
                </div>
                <div className="dash-widget__topbar-links">
                  <Link to="/admin/logs" className="section-header__link">
                    Xem tất cả <IconArrowRight />
                  </Link>
                  <Link to="/admin/login-security?tab=sessions" className="section-header__link section-header__link--alt">
                    Lịch sử đăng nhập <IconArrowRight />
                  </Link>
                </div>
              </div>

              <div className="dash-widget__body dash-widget__body--logs">
                <div className="dash-logs-section dash-logs-section--scroll-target">
                  <div className="dash-logs-section__body">
                    {combinedActivity.length > 0 ? (
                      combinedActivity.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="dash-logs-item"
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          {entry.kind === 'audit' ? (
                            <ActivityItem log={entry.payload} />
                          ) : (
                            <LoginItem item={entry.payload} />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-state__icon" style={{ color: '#94a3b8' }}>
                          <IconLog />
                        </div>
                        <p>Chưa có hoạt động nào được ghi nhận</p>
                        <span className="empty-state__hint">
                          Hãy thao tác trên hệ thống để tạo nhật ký đầu tiên
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 4: Quick Actions ──────────────────────────────── */}
          <div className="dash-row-2">
            <div className="dash-widget dash-widget--span-2">
              <SectionHeader
                dot="linear-gradient(135deg, #4f46e5, #7c3aed)"
                title="Thao tác nhanh"
                badge={QUICK_ACTIONS.length}
              />
              <div className="dash-widget__body dash-widget__body--qa">
                {QUICK_ACTIONS.map((qa) => (
                  <QuickAction key={qa.to} {...qa} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

