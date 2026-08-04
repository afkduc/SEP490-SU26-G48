import { useState, useEffect } from 'react';
import './components/AdminDrawer.css';

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
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(seconds) {
  if (seconds === undefined || seconds === null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  let parts = [];
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
    const map = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };
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
  if (upper.includes('FORCE')) return <span className="badge badge--orange">{ACTION_LABELS.FORCE_LOGOUT}</span>;
  if (upper.includes('LOGOUT') || upper.includes('SIGNOUT')) return <span className="badge badge--secondary">{ACTION_LABELS.LOGOUT}</span>;
  if (upper.includes('LOGIN')) return <span className="badge badge--success">{ACTION_LABELS.LOGIN}</span>;
  return <span className="badge badge--secondary">{ACTION_LABELS[upper] || 'Thao tác khác'}</span>;
}

function StatusBadge({ status }) {
  if (!status) return null;
  const cls =
    status === 'active' ? 'badge--success' :
    status === 'ended' ? 'badge--secondary' :
    status === 'failed' ? 'badge--danger' :
    'badge--secondary';
  return <span className={`badge ${cls}`}>{STATUS_LABELS[status] || 'Không xác định'}</span>;
}

function DetailRow({ label, value, mono, multiline }) {
  return (
    <div className="detail-list__item">
      <dt>{label}</dt>
      <dd className={mono ? 'font-mono' : ''} style={multiline ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : undefined}>
        {value || <span style={{ color: '#cbd5e1' }}>—</span>}
      </dd>
    </div>
  );
}

export default function SessionDetailDrawer({ session, onClose, onOpenDevicesToProcess }) {
  // Live tick - cập nhật thời lượng real-time cho phiên đang active
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (session?.status !== 'active') return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [session?.status, session?.id]);

  if (!session) return null;

  const fullName = session.user_name || 'Người dùng';
  const phone = session.phone_number || '';
  // Uu tien browser/os da duoc BE parse san. Chi fallback parse UA neu BE chua co.
  const browser = session.browser
    ? { name: session.browser, version: '', full: session.user_agent || '' }
    : parseBrowser(session.user_agent);
  const os = session.os || parseOs(session.user_agent);
  const device = parseDevice(session.user_agent);
  // tick được dùng để ép re-render mỗi giây cho phiên active
  void tick;

  // Tính toán thời lượng: nếu phiên active → tính từ login → now; nếu ended → từ DB
  let durationText = '—';
  let isLive = false;
  if (session.status === 'active' && session.login_time) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(session.login_time).getTime()) / 1000));
    durationText = formatDuration(seconds);
    isLive = true;
  } else if (session.session_duration_seconds != null) {
    durationText = formatDuration(session.session_duration_seconds);
  }

  // Phát hiện dấu hiệu bất thường (đơn giản, dựa trên dữ liệu phiên)
  const warnings = [];
  if (session.action_type === 'LOGIN_FAILED') warnings.push('Đăng nhập thất bại');
  if (!session.user_id) warnings.push('Không xác định được người dùng');
  if (!session.ip_address) warnings.push('Không ghi nhận địa chỉ IP');

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer">
        <div className="drawer__header">
          <div className="drawer__title-block">
            <div className="drawer__title-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="drawer__title">Chi tiết phiên đăng nhập</h2>
          </div>
          <button className="drawer__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          {/* Session card */}
          <div className="user-info-card">
            <div className="user-info-card__avatar">
              {fullName.split(' ').filter(Boolean).slice(-2).map((p) => p[0]).join('').toUpperCase() || '?'}
            </div>
            <h3 className="user-info-card__name">{fullName}</h3>
            <p className="user-info-card__username">
              {phone && `· ${phone}`}
            </p>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <ActionBadge action={session.action_type} />
              <StatusBadge status={session.status} />
            </div>
          </div>

          {/* Thong tin phien */}
          <dl className="detail-list">
            <div className="detail-list__group">
              <div className="detail-list__group-title">Thông tin phiên</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="ID phiên" value={`#${session.id}`} mono />
              <DetailRow label="Thời điểm đăng nhập" value={formatDateTime(session.login_time)} />
              <DetailRow label="Thời điểm đăng xuất" value={formatDateTime(session.logout_time)} />
              <DetailRow
                label="Thời lượng"
                value={
                  isLive ? (
                    <span style={{ color: '#0891b2', fontWeight: 600 }}>
                      {durationText} <span style={{ fontSize: '0.7rem', fontWeight: 500, marginLeft: 4 }}>(đang chạy…)</span>
                    </span>
                  ) : durationText
                }
              />
              <DetailRow label="Hành động" value={<ActionBadge action={session.action_type} />} />
              <DetailRow label="Trạng thái" value={<StatusBadge status={session.status} />} />
            </div>

            <div className="detail-list__group">
              <div className="detail-list__group-title">Người dùng</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="Họ tên" value={fullName} />
              <DetailRow label="Số điện thoại" value={phone} />
              <DetailRow label="Mã người dùng" value={session.user_id != null ? `#${session.user_id}` : null} mono />
              <DetailRow label="Chi nhánh" value={session.branch_name || (session.branch_id ? `Chi nhánh #${session.branch_id}` : null)} />
            </div>

            <div className="detail-list__group">
              <div className="detail-list__group-title">Thiết bị & Mạng</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="Địa chỉ IP" value={session.ip_address} mono />
              <DetailRow label="Thiết bị" value={device} />
              <DetailRow label="Hệ điều hành" value={os} />
              <DetailRow label="Trình duyệt" value={browser.version ? `${browser.name} ${browser.version}` : browser.name} />
              <DetailRow label="Thông tin trình duyệt" value={session.user_agent} mono multiline />
            </div>

            {session.failure_reason && (
              <>
                <div className="detail-list__group">
                  <div className="detail-list__group-title">Lý do thất bại</div>
                </div>
                <div className="detail-list__group">
                  <DetailRow label="Chi tiết" value={session.failure_reason} multiline />
                </div>
              </>
            )}

            {warnings.length > 0 && (
              <>
                <div className="detail-list__group">
                  <div className="detail-list__group-title" style={{ color: '#b91c1c' }}>Cảnh báo bất thường</div>
                </div>
                <div className="detail-list__group">
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#b91c1c', fontSize: '0.85rem' }}>
                    {warnings.map((w) => (<li key={w}>{w}</li>))}
                  </ul>
                </div>
              </>
            )}
          </dl>
        </div>

        {session.status === 'active' && typeof onOpenDevicesToProcess === 'function' && (
          <div className="drawer__footer" style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
              Tab Lịch sử chỉ xem. Để đăng xuất thiết bị này, mở tab Thiết bị rồi bấm Buộc đăng xuất.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ width: '100%' }}
              onClick={onOpenDevicesToProcess}
            >
              Mở tab Thiết bị để đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}