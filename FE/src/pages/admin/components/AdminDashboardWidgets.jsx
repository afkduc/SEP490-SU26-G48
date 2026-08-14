import { Link } from 'react-router-dom';
import { humanizeNotificationMessage } from '../../../utils/notificationDisplay';
import {
  humanizeAuditDescription,
  getAuditTableLabel,
  getHttpMethodLabel,
  formatDurationMs,
} from '../../../utils/auditDisplay';
import { formatPhoneDisplay } from '../../../utils/validation';
import {
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconClock,
  IconGlobe,
  IconInfo,
  IconLock,
  IconLogin,
  IconTerminal,
} from './AdminDashboardIcons';
import {
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  getActionBadge,
  getResponseBadge,
  getStatusBadge,
  getAlertStyle,
  inferCategory,
  inferSeverity,
  resolveAlertActor,
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  CATEGORY_LABELS,
  buildActivityDetails,
} from './adminDashboardFormatters';

export function getAlertIcon(iconType) {
  switch (iconType) {
    case 'lock':
      return <IconLock />;
    case 'alert':
      return <IconAlert />;
    case 'user':
      return <IconInfo />;
    default:
      return <IconInfo />;
  }
}

export function StatCard({ icon, label, value, sub, accent, trend }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-card__icon-wrap">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value ?? '—'}</div>
        <div className="stat-card__label">{label}</div>
        {sub && <div className="stat-card__sub">{sub}</div>}
        {trend !== undefined && (
          <div className={`stat-card__trend ${trend >= 0 ? 'trend--up' : 'trend--down'}`}>
            <span>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({ dot, title, badge, link, linkLabel }) {
  return (
    <div className="section-header">
      <div className="section-header__left">
        <span className="section-header__dot" style={{ background: dot }} />
        <h2 className="section-header__title">{title}</h2>
        {badge !== undefined && <span className="section-header__badge">{badge}</span>}
      </div>
      {link && (
        <Link to={link} className="section-header__link">
          {linkLabel || 'Xem tất cả'} <IconArrowRight />
        </Link>
      )}
    </div>
  );
}

export function AlertItem({ alert }) {
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
    }
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
          <div className="alert-item__title" style={{ color: style.color }}>
            {title}
          </div>
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
          {categoryLabel && <span className="alert-item__chip">{categoryLabel}</span>}
          {alert.affectedEntity && (
            <span className="alert-item__chip alert-item__chip--mono">{alert.affectedEntity}</span>
          )}
          {actor && <span className="alert-item__chip">Bởi: {actor}</span>}
        </div>
      </div>
      <div className="alert-item__time">
        <div className="alert-item__time-rel">{formatRelativeTime(alert.time)}</div>
        {alert.time && <div className="alert-item__time-abs">{formatDateTime(alert.time)}</div>}
      </div>
    </div>
  );
}

export function ActivityItem({ log }) {
  const badge = getActionBadge(log.action);
  const respBadge = getResponseBadge(log.responseStatus ?? log.response_status);
  const actionUpper = String(log.action || '').toUpperCase();
  const isAuthAction = ['LOGIN', 'FAILED_LOGIN', 'LOGOUT', 'FORCE_LOGO', 'FORCE_LOGOUT'].includes(
    actionUpper
  );

  // Lay ten actor voi fallback an toan
  const actor = log.actorName || log.user_name || log.userName || log.actor || 'Hệ thống';

  const details =
    humanizeAuditDescription(
      log.details || log.description,
      log.action,
      log.new_value || log.newValue
    ) ||
    buildActivityDetails(log) ||
    (log.ipAddress || log.ip_address ? `Từ IP ${log.ipAddress || log.ip_address}` : null);

  const tableKey = log.tableName || log.table_name || log.targetType;
  const rawEntityCode = String(log.entityCode || log.entity_code || '').trim();
  // entity_code từng lưu VARCHAR → tiếng Việt thành "Tr?n..."; ẩn khi lỗi / trùng tên actor / sự kiện auth
  const showEntityCode = Boolean(
    rawEntityCode && !isAuthAction && rawEntityCode !== actor && !/\?/.test(rawEntityCode)
  );

  return (
    <div className="activity-item">
      <div className="activity-item__bar" style={{ background: badge.color }} />
      <div className="activity-item__body">
        <div className="activity-item__top">
          <span
            className="activity-item__badge"
            style={{ background: badge.bg, color: badge.color }}
          >
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
          {(log.requestMethod || log.request_method) && (
            <span className="activity-item__method">
              {getHttpMethodLabel(log.requestMethod || log.request_method)}
            </span>
          )}
        </div>

        {details && <div className="activity-item__details">{details}</div>}

        <div className="activity-item__meta">
          {tableKey && (
            <span className="activity-item__meta-item activity-item__meta-item--strong">
              <IconTerminal />
              <span>{getAuditTableLabel(tableKey)}</span>
            </span>
          )}
          {showEntityCode && (
            <span className="activity-item__meta-item activity-item__meta-item--code">
              {rawEntityCode}
            </span>
          )}
          {!showEntityCode &&
            !rawEntityCode &&
            (log.recordId ?? log.record_id ?? log.targetId) != null && (
              <span className="activity-item__meta-item activity-item__meta-item--code">
                #{log.recordId ?? log.record_id ?? log.targetId}
              </span>
            )}
          {(log.ipAddress || log.ip_address) && (
            <span className="activity-item__meta-item">
              <IconGlobe /> {log.ipAddress || log.ip_address}
            </span>
          )}
          {(log.durationMs != null || log.duration_ms != null) && (
            <span className="activity-item__meta-item">
              <IconClock /> {formatDurationMs(log.durationMs ?? log.duration_ms)}
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

export function LoginItem({ item }) {
  const statusBadge = getStatusBadge(item.status);
  const actionBadge = getActionBadge(item.actionType);

  const rawPhone = item.phoneNumber || item.phone_number;
  const displayPhone = rawPhone ? formatPhoneDisplay(rawPhone) : null;

  // Fallback thong minh: uu tien userName > phone > userId > email > "Nguoi dung #id"
  const displayName =
    item.userName ||
    item.user_name ||
    (displayPhone ? `SDT: ${displayPhone}` : null) ||
    (item.email ? item.email : null) ||
    (item.userId || item.user_id ? `Người dùng #${item.userId || item.user_id}` : 'Người dùng');

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
          <span
            className="login-item__status"
            style={{ background: statusBadge.bg, color: statusBadge.color }}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="login-item__meta">
          <span>
            <IconGlobe /> {item.ipAddress || item.ip_address || '—'}
          </span>
          <span>
            <IconClock /> {formatDateTime(item.loginTime || item.login_time)}
          </span>
          {(item.sessionDuration || item.session_duration_seconds) > 0 && (
            <span>
              <IconCalendar />{' '}
              {formatDuration(item.sessionDuration || item.session_duration_seconds)}
            </span>
          )}
          {displayPhone && item.userName && (
            <span className="login-item__phone">{displayPhone}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuickAction({ to, icon, label, desc, accent }) {
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
