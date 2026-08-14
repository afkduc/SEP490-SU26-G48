import { useEffect, useState } from 'react';
import { formatPhoneDisplay } from '../../utils/validation';
import './LoginSessionDetailPage.css';

const ACTION_LABELS = {
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
};

const STATUS_LABELS = {
  active: 'Đang hoạt động',
  ended: 'Đã đăng xuất',
  failed: 'Thất bại',
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(seconds) {
  if (seconds === undefined || seconds === null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} giờ`);
  if (remM > 0) parts.push(`${remM} phút`);
  if (s > 0) parts.push(`${s} giây`);
  return parts.join(' ') || '0 giây';
}

function parseBrowser(ua) {
  if (!ua) return { name: '—', version: '', full: '' };
  const regexes = [
    { name: 'Edge', re: /Edg\/([\d.]+)/ },
    { name: 'Chrome', re: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', re: /Firefox\/([\d.]+)/ },
    { name: 'Safari', re: /Safari\/([\d.]+)/ },
    { name: 'Opera', re: /OPR\/([\d.]+)/ },
  ];
  for (const { name, re } of regexes) {
    const m = ua.match(re);
    if (m) return { name, version: m[1], full: ua };
  }
  return { name: 'Không xác định', version: '', full: ua };
}

function parseOs(ua) {
  if (!ua) return '—';
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT ([\d.]+)/);
    const map = { '10.0': 'Windows 10/11', 6.3: 'Windows 8.1', 6.2: 'Windows 8', 6.1: 'Windows 7' };
    return map[m?.[1]] || `Windows NT ${m?.[1]}`;
  }
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    return m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  }
  if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return `Android ${m?.[1] || ''}`;
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/);
    return `iOS ${m?.[1]?.replace(/_/g, '.') || ''}`;
  }
  if (/Linux/.test(ua)) return 'Linux';
  return ua.slice(0, 60);
}

function parseDevice(ua) {
  if (!ua) return '—';
  if (/Mobile|Android|iPhone|iPad/.test(ua)) {
    if (/iPad/.test(ua)) return 'Máy tính bảng (iPad)';
    return 'Điện thoại';
  }
  return 'Máy tính';
}

function ActionBadge({ action }) {
  if (!action) return null;
  const upper = String(action).toUpperCase();
  if (upper.includes('FORCE'))
    return <span className="badge badge--orange">{ACTION_LABELS.FORCE_LOGOUT}</span>;
  if (upper.includes('LOGOUT') || upper.includes('SIGNOUT'))
    return <span className="badge badge--secondary">{ACTION_LABELS.LOGOUT}</span>;
  if (upper.includes('LOGIN'))
    return <span className="badge badge--success">{ACTION_LABELS.LOGIN}</span>;
  return <span className="badge badge--secondary">{ACTION_LABELS[upper] || 'Thao tác khác'}</span>;
}

function StatusBadge({ status }) {
  if (!status) return null;
  const cls =
    status === 'active'
      ? 'badge--success'
      : status === 'ended'
        ? 'badge--secondary'
        : status === 'failed'
          ? 'badge--danger'
          : 'badge--secondary';
  return <span className={`badge ${cls}`}>{STATUS_LABELS[status] || 'Không xác định'}</span>;
}

function Field({ label, value, mono, multiline }) {
  return (
    <div className="session-detail-field">
      <div className="session-detail-field__label">{label}</div>
      <div
        className={`session-detail-field__value${mono ? ' session-detail-field__value--mono' : ''}`}
        style={multiline ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : undefined}
      >
        {value || <span className="session-detail-field__empty">—</span>}
      </div>
    </div>
  );
}

/** Nội dung chi tiết phiên — dùng cho trang full (không drawer). */
export function LoginSessionDetailContent({ session, onOpenDevicesToProcess }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (session?.status !== 'active') return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [session?.status, session?.id]);

  if (!session) return null;

  const fullName = session.user_name || 'Người dùng';
  const phone = session.phone_number ? formatPhoneDisplay(session.phone_number) : '';
  const browser = session.browser
    ? { name: session.browser, version: '', full: session.user_agent || '' }
    : parseBrowser(session.user_agent);
  const os = session.os || parseOs(session.user_agent);
  const device = parseDevice(session.user_agent);
  void tick;

  let durationText = '—';
  let isLive = false;
  if (session.status === 'active' && session.login_time) {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(session.login_time).getTime()) / 1000)
    );
    durationText = formatDuration(seconds);
    isLive = true;
  } else if (session.session_duration_seconds != null) {
    durationText = formatDuration(session.session_duration_seconds);
  }

  const warnings = [];
  if (session.action_type === 'LOGIN_FAILED') warnings.push('Đăng nhập thất bại');
  if (!session.user_id) warnings.push('Không xác định được người dùng');
  if (!session.ip_address) warnings.push('Không ghi nhận địa chỉ IP');

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="session-detail-page__body">
      <div className="session-detail-hero">
        <div className="session-detail-hero__avatar">{initials}</div>
        <div className="session-detail-hero__meta">
          <h2 className="session-detail-hero__name">{fullName}</h2>
          <p className="session-detail-hero__sub">
            Phiên #{session.id}
            {phone ? ` · ${phone}` : ''}
          </p>
          <div className="session-detail-hero__badges">
            <ActionBadge action={session.action_type} />
            <StatusBadge status={session.status} />
          </div>
        </div>
      </div>

      <div className="session-detail-sections">
        <section className="session-detail-section">
          <h3 className="session-detail-section__title">Thông tin phiên</h3>
          <div className="session-detail-grid">
            <Field label="ID phiên" value={`#${session.id}`} mono />
            <Field label="Thời điểm đăng nhập" value={formatDateTime(session.login_time)} />
            <Field label="Thời điểm đăng xuất" value={formatDateTime(session.logout_time)} />
            <Field
              label="Thời lượng"
              value={
                isLive ? (
                  <span className="session-detail-live">
                    {durationText} <span className="session-detail-live__hint">(đang chạy…)</span>
                  </span>
                ) : (
                  durationText
                )
              }
            />
            <Field label="Hành động" value={<ActionBadge action={session.action_type} />} />
            <Field label="Trạng thái" value={<StatusBadge status={session.status} />} />
          </div>
        </section>

        <section className="session-detail-section">
          <h3 className="session-detail-section__title">Người dùng</h3>
          <div className="session-detail-grid">
            <Field label="Họ tên" value={fullName} />
            <Field label="Số điện thoại" value={phone} />
            <Field
              label="Mã người dùng"
              value={session.user_id != null ? `#${session.user_id}` : null}
              mono
            />
            <Field
              label="Chi nhánh"
              value={
                session.branch_name ||
                (session.branch_id ? `Chi nhánh #${session.branch_id}` : null)
              }
            />
          </div>
        </section>

        <section className="session-detail-section">
          <h3 className="session-detail-section__title">Thiết bị &amp; mạng</h3>
          <div className="session-detail-grid">
            <Field label="Địa chỉ IP" value={session.ip_address} mono />
            <Field label="Thiết bị" value={device} />
            <Field label="Hệ điều hành" value={os} />
            <Field
              label="Trình duyệt"
              value={browser.version ? `${browser.name} ${browser.version}` : browser.name}
            />
            <Field label="Thông tin trình duyệt" value={session.user_agent} mono multiline />
          </div>
        </section>

        {session.failure_reason && (
          <section className="session-detail-section">
            <h3 className="session-detail-section__title">Lý do thất bại</h3>
            <div className="session-detail-grid">
              <Field label="Chi tiết" value={session.failure_reason} multiline />
            </div>
          </section>
        )}

        {warnings.length > 0 && (
          <section className="session-detail-section session-detail-section--warn">
            <h3 className="session-detail-section__title">Cảnh báo bất thường</h3>
            <ul className="session-detail-warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {session.status === 'active' && typeof onOpenDevicesToProcess === 'function' && (
        <div className="session-detail-footer">
          <p>
            Tab Lịch sử chỉ xem. Để đăng xuất thiết bị này, mở tab Thiết bị rồi bấm Buộc đăng xuất.
          </p>
          <button type="button" className="btn btn--primary" onClick={onOpenDevicesToProcess}>
            Mở tab Thiết bị để đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
