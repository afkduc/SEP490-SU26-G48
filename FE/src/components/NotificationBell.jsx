import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, normalizeRoles } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import { formatDateSafe } from '../utils/dateUtils';
import { humanizeNotificationMessage } from '../utils/notificationDisplay';
import { dispatchLoginChallenge } from '../services/authApi';
import { auditApi } from '../services/auditApi';
import { dispatchSessionTakenOverPrompt } from './SessionTakenOverPrompt';
import { ROLES } from '../constants/roles';
import './NotificationBell.css';

function parseNotifMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function notifTypeOf(notif, metadata = {}) {
  return notif?.type || metadata?.eventType || metadata?.ruleKey || '';
}

function isSessionTakeoverNotif(type, metadata = {}) {
  const t = String(type || '').toUpperCase();
  const rule = String(metadata.ruleKey || '').toLowerCase();
  return (
    t === 'SESSION_TAKEN_OVER'
    || t === 'SECURITY_SESSION_TAKEOVER'
    || rule === 'session_takeover'
    || /đăng nhập trên thiết bị khác|đã có người đăng nhập tài khoản/i.test(
      `${metadata.title || ''} ${metadata.message || ''}`,
    )
  );
}

function isNewDeviceNotif(type, metadata = {}) {
  const t = String(type || '').toUpperCase();
  const rule = String(metadata.ruleKey || '').toLowerCase();
  return (
    t === 'NEW_DEVICE'
    || t === 'SECURITY_NEW_DEVICE_IP'
    || rule === 'new_device_ip'
    || /đăng nhập từ thiết bị mới|ip\/thiết bị mới/i.test(
      `${metadata.title || ''} ${metadata.message || ''}`,
    )
  );
}

function isAdminSecurityNotif(type) {
  const t = String(type || '').toUpperCase();
  return t.startsWith('SECURITY_');
}

/** Thông báo nghiệp vụ CRUD — bấm vào mở nhật ký audit tương ứng */
function isCrudAuditLinkable(type) {
  const t = String(type || '').toUpperCase();
  if (!t || t.startsWith('SECURITY_')) return false;
  if ([
    'LOGIN_CHALLENGE',
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'NEW_DEVICE',
    'SESSION_TAKEN_OVER',
    'FORCE_LOGOUT',
    'FORCE_LOGO',
  ].includes(t)) {
    return false;
  }
  return (
    /_(CREATED|UPDATED|DISABLED|ENABLED|DEACTIVATED|REACTIVATED|APPROVED|REJECTED|TRANSFERRED)$/.test(t)
    || /^(REPAIR_ORDER|SETTLEMENT|PRODUCT|USER|BRANCH|CUSTOMER|IMPORT_REQUEST|EXPORT_REQUEST|VEHICLE_OWNERSHIP|BRANCH_MANAGER)_/.test(t)
    || t === 'USER_PASSWORD_RESET'
  );
}

function preferredAuditAction(type) {
  const t = String(type || '').toUpperCase();
  if (/_CREATED$|_APPROVED$/.test(t)) return 'CREATE';
  if (/_(UPDATED|DISABLED|ENABLED|DEACTIVATED|REACTIVATED|REJECTED|TRANSFERRED|PASSWORD_RESET)$/.test(t)) {
    return 'UPDATE';
  }
  return undefined;
}

function extractEntityCode(metadata = {}, message = '') {
  const direct = metadata.targetCode || metadata.entityCode;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const m = String(message || '').match(/\b([A-Z]{2,}(?:-[A-Z0-9]+)*-\d{4}-\d+)\b/);
  return m ? m[1] : '';
}

async function resolveAuditLogPath(notif, metadata = {}) {
  const type = notifTypeOf(notif, metadata);
  const directId = metadata.auditLogId || metadata.audit_log_id;
  if (directId != null && String(directId).trim()) {
    return `/admin/logs/${directId}`;
  }

  const code = extractEntityCode(metadata, notif.message || metadata.message);
  if (!code || !isCrudAuditLinkable(type)) return null;

  const action = preferredAuditAction(type);
  try {
    const res = await auditApi.getAuditLogs({
      entityCode: code,
      ...(action ? { action } : {}),
      page: 1,
      pageSize: 10,
    });
    const items = res?.items || [];
    if (items.length === 0 && action) {
      const fallback = await auditApi.getAuditLogs({
        entityCode: code,
        page: 1,
        pageSize: 5,
      });
      const any = fallback?.items?.[0];
      if (any?.id) return `/admin/logs/${any.id}`;
    } else if (items[0]?.id) {
      // Ưu tiên bản ghi gần thời điểm thông báo nhất
      const notifTs = Date.parse(notif.createdAt || notif.timestamp || metadata.timestamp || '') || 0;
      let best = items[0];
      if (notifTs) {
        let bestDiff = Infinity;
        for (const item of items) {
          const ts = Date.parse(item.logged_at || item.loggedAt || '') || 0;
          const diff = Math.abs(ts - notifTs);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = item;
          }
        }
      }
      return `/admin/logs/${best.id}`;
    }
  } catch (_) {
    /* fallback list below */
  }

  return `/admin/logs?entityCode=${encodeURIComponent(code)}`;
}

function buildLoginSecurityPath(metadata = {}, { tab = 'devices' } = {}) {
  const params = new URLSearchParams();
  if (tab && tab !== 'devices') params.set('tab', tab);
  // Ưu tiên relatedUserId (user bị cảnh báo), không dùng nhầm userId người nhận thông báo
  const userId = metadata.relatedUserId || metadata.targetUserId;
  const userName = metadata.userName || metadata.targetUserName || metadata.targetName;
  const ip = metadata.ipAddress || metadata.ip || metadata.location;
  if (userId != null && userId !== '') params.set('userId', String(userId));
  if (userName) params.set('search', String(userName));
  if (ip) params.set('ip', String(ip));
  const qs = params.toString();
  return qs ? `/admin/login-security?${qs}` : '/admin/login-security';
}

/** User bị cảnh báo bảo mật (không phải người nhận chuông). */
function relatedUserIdFromMeta(metadata = {}) {
  const id = metadata.relatedUserId ?? metadata.targetUserId;
  if (id == null || id === '') return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function notifDisplayTitle(notif, metadata = {}) {
  const type = notifTypeOf(notif, metadata);
  const who = metadata.userName || metadata.targetUserName || metadata.targetName;
  if (type === 'SECURITY_SESSION_TAKEOVER' && who) {
    return `Đăng nhập trên thiết bị khác — ${who}`;
  }
  if (type === 'SECURITY_NEW_DEVICE_IP' && who) {
    return `Thiết bị / IP mới — ${who}`;
  }
  if (type === 'SECURITY_NEW_DEVICE_IP') {
    return ICON_LABELS.SECURITY_NEW_DEVICE_IP;
  }
  return notif.title || ICON_LABELS[type] || 'Thông báo';
}

function notifDisplayMessage(notif, metadata = {}) {
  const raw = humanizeNotificationMessage(notif.message, metadata || notif.metadata);
  if (raw && String(raw).trim()) return raw;
  const who = metadata.userName || metadata.targetUserName || metadata.targetName;
  const type = notifTypeOf(notif, metadata);
  if (type === 'SECURITY_SESSION_TAKEOVER' && who) {
    return `Cảnh báo bảo mật về tài khoản «${who}». Mở Bảo mật đăng nhập để xem phiên / đăng xuất thiết bị.`;
  }
  if (type === 'SECURITY_NEW_DEVICE_IP' && who) {
    return `Tài khoản «${who}» đăng nhập từ thiết bị hoặc IP mới.`;
  }
  return raw || '';
}

const ICON_COLORS = {
  LOGIN_SUCCESS: '#3f3f46',
  LOGIN_FAILED: '#52525b',
  NEW_DEVICE: '#52525b',
  FORCE_LOGOUT: '#52525b',
  SESSION_TAKEN_OVER: '#27272a',
  PASSWORD_CHANGED: '#3f3f46',
  ROLE_CHANGED: '#3f3f46',
  SECURITY_ALERT: '#52525b',
  SECURITY_FAILED_LOGIN_BURST: '#52525b',
  SECURITY_NEW_ADMIN_ROLE: '#27272a',
  SECURITY_INACTIVE_ADMIN: '#52525b',
  SECURITY_NEW_DEVICE_IP: '#3f3f46',
  SECURITY_SESSION_TAKEOVER: '#27272a',
};

const SEVERITY_COLORS = {
  success:  '#3f3f46',
  info:     '#3f3f46',
  warning:  '#52525b',
  error:    '#52525b',
  critical: '#27272a',
};

const ICON_LABELS = {
  LOGIN_SUCCESS: 'Đăng nhập',
  LOGIN_FAILED: 'Thất bại',
  NEW_DEVICE: 'Thiết bị mới',
  FORCE_LOGOUT: 'Bị đăng xuất',
  SESSION_TAKEN_OVER: 'Bị thay phiên',
  PASSWORD_CHANGED: 'Mật khẩu',
  ROLE_CHANGED: 'Phân quyền',
  SECURITY_ALERT: 'Bảo mật',
  SECURITY_FAILED_LOGIN_BURST: 'Brute-force',
  SECURITY_NEW_ADMIN_ROLE: 'Admin mới',
  SECURITY_INACTIVE_ADMIN: 'Admin idle',
  SECURITY_NEW_DEVICE_IP: 'Đăng nhập từ thiết bị mới',
  SECURITY_SESSION_TAKEOVER: 'Thiết bị khác',
  USER_CREATED: 'Tạo người dùng',
  USER_UPDATED: 'Cập nhật người dùng',
  USER_DISABLED: 'Vô hiệu hóa người dùng',
  USER_ENABLED: 'Kích hoạt người dùng',
  USER_PASSWORD_RESET: 'Đặt lại mật khẩu',
  REPAIR_ORDER_CREATED: 'Tạo phiếu sửa',
  REPAIR_ORDER_UPDATED: 'Cập nhật phiếu sửa',
  SETTLEMENT_CREATED: 'Tạo quyết toán',
  SETTLEMENT_UPDATED: 'Cập nhật quyết toán',
  IMPORT_REQUEST_APPROVED: 'Duyệt nhập kho',
  IMPORT_REQUEST_REJECTED: 'Từ chối nhập kho',
  EXPORT_REQUEST_CREATED: 'Tạo xuất kho',
  BRANCH_CREATED: 'Tạo chi nhánh',
  BRANCH_UPDATED: 'Cập nhật chi nhánh',
  BRANCH_DEACTIVATED: 'Ngừng chi nhánh',
  BRANCH_REACTIVATED: 'Kích hoạt chi nhánh',
  ROLE_CREATED: 'Tạo vai trò',
  ROLE_UPDATED: 'Cập nhật vai trò',
  ROLE_DELETED: 'Xóa vai trò',
  PRODUCT_CREATED: 'Tạo sản phẩm',
  PRODUCT_UPDATED: 'Cập nhật sản phẩm',
  PRODUCT_DISABLED: 'Ngừng sản phẩm',
  PRODUCT_DELETED: 'Ngừng sản phẩm',
  CUSTOMER_UPDATED: 'Cập nhật khách hàng',
  SPECIALTY_CREATED: 'Tạo chuyên môn',
  SPECIALTY_UPDATED: 'Cập nhật chuyên môn',
  SPECIALTY_DELETED: 'Xóa chuyên môn',
};

/** Icon SVG theo loại — không dùng chữ cái (tránh nhầm là avatar người B/T…). */
function NotifTypeIcon({ type }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (type === 'LOGIN_FAILED' || type === 'SECURITY_FAILED_LOGIN_BURST') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (type === 'SESSION_TAKEN_OVER' || type === 'SECURITY_SESSION_TAKEOVER' || type === 'FORCE_LOGOUT' || type === 'FORCE_LOGO') {
    return (
      <svg {...common}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (type === 'NEW_DEVICE' || type === 'SECURITY_NEW_DEVICE_IP') {
    return (
      <svg {...common}>
        <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (type === 'LOGIN_SUCCESS') {
    return (
      <svg {...common}>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    );
  }
  if (type === 'PASSWORD_CHANGED' || type === 'USER_PASSWORD_RESET') {
    return (
      <svg {...common}>
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  if (type === 'ROLE_CHANGED' || type === 'SECURITY_NEW_ADMIN_ROLE' || String(type || '').startsWith('ROLE_')) {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (String(type || '').startsWith('SECURITY_') || type === 'SECURITY_ALERT') {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  // CRUD / mặc định: chuông nhỏ
  return (
    <svg {...common}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function getIcon(notif) {
  const color = SEVERITY_COLORS[notif.severity] || ICON_COLORS[notif.type] || '#71717a';
  return (
    <span
      className="notif-bell__item-icon"
      style={{ background: color }}
      aria-hidden
      title={ICON_LABELS[notif.type] || notif.title || 'Thông báo'}
    >
      <NotifTypeIcon type={notif.type} />
    </span>
  );
}

/**
 * NotificationBell - bell icon voi badge dem unread, click mo dropdown
 * danh sach notification moi nhat.
 *
 * Hook vao useNotifications (SSE realtime + poll fallback).
 */
export default function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    connected,
    loading,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications(token);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const roles = normalizeRoles(user?.roles);
  const canOpenLoginSecurity = roles.includes(ROLES.ADMIN) || roles.includes(ROLES.GENERAL_DIRECTOR);

  // Close dropdown khi click ngoai
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close bang ESC
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleItemClick = useCallback(async (notif) => {
    if (!notif.isRead && !notif.readAt) {
      markRead(notif.id);
    }
    const metadata = {
      ...parseNotifMeta(notif.metadata),
      title: notif.title,
      message: notif.message,
    };
    const type = notifTypeOf(notif, metadata);
    const myId = Number(user?.userId ?? user?.id);
    const relatedId = relatedUserIdFromMeta(metadata);
    const isAboutMe = relatedId != null && Number.isFinite(myId) && relatedId === myId;

    // 1) Challenge đăng nhập thiết bị mới (đồng ý / từ chối)
    if (type === 'LOGIN_CHALLENGE' || metadata?.eventType === 'LOGIN_CHALLENGE') {
      const pendingId = metadata?.pendingId || notif.pendingId;
      if (pendingId) {
        dispatchLoginChallenge({
          pendingId,
          metadata: metadata || {},
          title: notif.title,
          message: notif.message,
          device: [metadata?.browser, metadata?.os].filter(Boolean).join(' · ') || undefined,
          ip: metadata?.ip,
        });
        setOpen(false);
      }
      return;
    }

    const promptPayload = {
      title: notif.title,
      message: notif.message,
      metadata: metadata || {},
      ip: metadata?.ip || metadata?.ipAddress || metadata?.location,
      browser: metadata?.browser,
      os: metadata?.os,
      device: [metadata?.browser, metadata?.os].filter(Boolean).join(' · ') || undefined,
      createdAt: notif.createdAt || notif.timestamp || metadata?.timestamp,
      canOpenDevices: canOpenLoginSecurity,
    };

    // 2) Cảnh báo SECURITY_* về CHÍNH admin đang xem → xử lý như thông báo cá nhân
    //    (không nhảy sang lọc user khác trên Bảo mật đăng nhập)
    if (isAdminSecurityNotif(type) && isAboutMe) {
      if (isSessionTakeoverNotif(type, metadata)) {
        dispatchSessionTakenOverPrompt({
          ...promptPayload,
          variant: 'session_takeover',
        });
        setOpen(false);
        return;
      }
      if (isNewDeviceNotif(type, metadata)) {
        dispatchSessionTakenOverPrompt({
          ...promptPayload,
          variant: 'new_device',
          deviceId: metadata?.deviceId || metadata?.device_id || null,
        });
        setOpen(false);
        return;
      }
    }

    // 3) Cảnh báo admin về USER KHÁC → màn Bảo mật đăng nhập (lọc đúng user đó)
    if (isAdminSecurityNotif(type) && canOpenLoginSecurity) {
      const tab = isSessionTakeoverNotif(type, metadata) ? 'sessions' : 'devices';
      navigate(buildLoginSecurityPath(metadata, { tab }));
      setOpen(false);
      return;
    }

    // 4) Thay phiên trên tài khoản của mình → popup bảo mật (quên mật khẩu)
    if (isSessionTakeoverNotif(type, metadata)) {
      dispatchSessionTakenOverPrompt({
        ...promptPayload,
        variant: 'session_takeover',
      });
      setOpen(false);
      return;
    }

    // 5) Đăng nhập thiết bị mới (của mình) → popup: Tin cậy / Đổi MK
    if (isNewDeviceNotif(type, metadata)) {
      dispatchSessionTakenOverPrompt({
        ...promptPayload,
        variant: 'new_device',
        deviceId: metadata?.deviceId || metadata?.device_id || null,
      });
      setOpen(false);
      return;
    }

    // 6) Thông báo nghiệp vụ (phiếu sửa, quyết toán, user, …) → chi tiết nhật ký
    if (isCrudAuditLinkable(type)) {
      const path = await resolveAuditLogPath(notif, metadata);
      if (path) {
        navigate(path);
        setOpen(false);
      }
    }
  }, [markRead, navigate, canOpenLoginSecurity, user]);

  return (
    <div className="notif-bell" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell__badge" aria-hidden>
            {unreadCount > 100 ? '99+' : unreadCount}
          </span>
        )}
        {/* Dot nho the hien SSE connect status */}
        <span
          className={`notif-bell__status notif-bell__status--${connected ? 'ok' : 'off'}`}
          aria-label={connected ? 'Realtime connected' : 'Realtime disconnected'}
        />
      </button>

      {open && (
        <div className="notif-bell__dropdown" role="menu">
          <div className="notif-bell__header">
            <h3>Thông báo</h3>
            <div className="notif-bell__header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-bell__action"
                  onClick={markAllRead}
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
              <button
                type="button"
                className="notif-bell__action"
                onClick={refresh}
                aria-label="Làm mới"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="notif-bell__list">
            {loading && notifications.length === 0 ? (
              <div className="notif-bell__empty">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-bell__empty">Không có thông báo nào</div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.isRead && !notif.readAt;
                const meta = parseNotifMeta(notif.metadata);
                const title = notifDisplayTitle(notif, meta);
                const message = notifDisplayMessage(notif, meta);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    className={`notif-bell__item ${isUnread ? 'is-unread' : ''}`}
                    onClick={() => handleItemClick(notif)}
                    role="menuitem"
                  >
                    {getIcon(notif)}
                    <div className="notif-bell__item-body">
                      <div className="notif-bell__item-title">
                        {title}
                      </div>
                      {message ? (
                        <div className="notif-bell__item-message">
                          {message}
                        </div>
                      ) : null}
                      <div className="notif-bell__item-time">
                        {formatDateSafe(notif.createdAt || notif.timestamp, {
                          timeZone: 'Asia/Ho_Chi_Minh',
                          locale: 'vi-VN',
                        })}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="notif-bell__item-dot" aria-hidden />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
