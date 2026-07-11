import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import {
  getAdminDashboardStats,
  getRecentLoginSessions,
} from '../../services/adminApi';
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
  if (diffMin < 1) return 'Vua xong';
  if (diffMin < 60) return `${diffMin} phut truoc`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} gio truoc`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngay truoc`;
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

function getActionBadge(action) {
  if (!action) return { label: 'UNKNOWN', bg: '#f1f5f9', color: '#64748b' };
  const upper = action.toUpperCase();
  if (upper.includes('CREATE') || upper.includes('INSERT')) return { label: 'TAO MOI', bg: '#dcfce7', color: '#15803d' };
  if (upper.includes('UPDATE') || upper.includes('EDIT')) return { label: 'CAP NHAT', bg: '#eef2ff', color: '#4338ca' };
  if (upper.includes('DELETE')) return { label: 'XOA', bg: '#fee2e2', color: '#dc2626' };
  if (upper.includes('LOGIN_FAILED')) return { label: 'DANG NHAP THAT BAI', bg: '#fee2e2', color: '#dc2626' };
  if (upper.includes('LOGIN') || upper.includes('LOGOUT')) return { label: upper.includes('LOGIN') ? 'DANG NHAP' : 'DANG XUAT', bg: '#e0f2fe', color: '#0369a1' };
  if (upper.includes('ASSIGN')) return { label: 'GAN QUYEN', bg: '#f3e8ff', color: '#7c3aed' };
  if (upper.includes('REVOKE')) return { label: 'THU HOI', bg: '#fef3c7', color: '#b45309' };
  if (upper.includes('PASSWORD')) return { label: 'DOI MK', bg: '#fce7f3', color: '#be185d' };
  return { label: action.toUpperCase(), bg: '#f1f5f9', color: '#475569' };
}

function getStatusBadge(status) {
  if (!status) return { label: '—', bg: '#f1f5f9', color: '#64748b' };
  const upper = status.toUpperCase();
  if (upper === 'SUCCESS' || upper === 'ACTIVE') return { label: 'Thanh cong', bg: '#dcfce7', color: '#15803d' };
  if (upper === 'FAILED' || upper === 'FAIL') return { label: 'That bai', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'LOCKED') return { label: 'Bi khoa', bg: '#fee2e2', color: '#dc2626' };
  if (upper === 'INACTIVE') return { label: 'Ngung hoat dong', bg: '#f1f5f9', color: '#64748b' };
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

function getAlertStyle(type) {
  switch (type) {
    case 'danger': return { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', iconBg: '#fee2e2' };
    case 'warning': return { bg: '#fffbeb', border: '#fde68a', color: '#d97706', iconBg: '#fef3c7' };
    case 'info': return { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', iconBg: '#dbeafe' };
    default: return { bg: '#f8fafc', border: '#e2e8f0', color: '#475569', iconBg: '#f1f5f9' };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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
          {linkLabel || 'Xem tat ca'} <IconArrowRight />
        </Link>
      )}
    </div>
  );
}

function AlertItem({ alert }) {
  const style = getAlertStyle(alert.type);
  return (
    <div className="alert-item" style={{ background: style.bg, borderColor: style.border }}>
      <div className="alert-item__icon" style={{ background: style.iconBg, color: style.color }}>
        {getAlertIcon(alert.icon)}
      </div>
      <div className="alert-item__content">
        <div className="alert-item__title" style={{ color: style.color }}>{alert.title}</div>
        <div className="alert-item__message">{alert.message}</div>
      </div>
      <div className="alert-item__time">{formatRelativeTime(alert.time)}</div>
    </div>
  );
}

function ActivityItem({ log }) {
  const badge = getActionBadge(log.action);
  return (
    <div className="activity-item">
      <div className="activity-item__bar" style={{ background: badge.color }} />
      <div className="activity-item__body">
        <div className="activity-item__top">
          <span className="activity-item__badge" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
          <span className="activity-item__actor">{log.actorName || 'He thong'}</span>
        </div>
        {log.details && (
          <div className="activity-item__details">{log.details}</div>
        )}
        <div className="activity-item__meta">
          {log.ipAddress && <span><IconGlobe /> {log.ipAddress}</span>}
          <span><IconClock /> {formatRelativeTime(log.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function LoginItem({ item }) {
  const statusBadge = getStatusBadge(item.status);
  const actionBadge = getActionBadge(item.actionType);
  return (
    <div className="login-item">
      <div className="login-item__avatar" style={{ background: actionBadge.color + '20', color: actionBadge.color }}>
        <IconLogin />
      </div>
      <div className="login-item__body">
        <div className="login-item__top">
          <span className="login-item__user">{item.userName || 'Unknown'}</span>
          <span className="login-item__status" style={{ background: statusBadge.bg, color: statusBadge.color }}>
            {statusBadge.label}
          </span>
        </div>
        <div className="login-item__meta">
          <span><IconGlobe /> {item.ipAddress || '—'}</span>
          <span><IconClock /> {formatDateTime(item.loginTime)}</span>
          {item.sessionDuration > 0 && (
            <span><IconCalendar /> {formatDuration(item.sessionDuration)}</span>
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

// Tab switcher noi bo: chi mot tab active tai mot thoi diem.
// Click chuyen tab se cap nhat state va doi noi dung ben duoi.
function LogsTabSwitcher({ activeTab, onChange, auditCount, loginCount }) {
  return (
    <div className="logs-tab-bar" role="tablist" aria-label="Loai nhat ky">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'activity'}
        className={'logs-tab-btn' + (activeTab === 'activity' ? ' logs-tab-btn--active' : '')}
        onClick={() => onChange('activity')}
      >
        <IconLog />
        <span>Nhat ky hoat dong</span>
        <span className="logs-tab-btn__badge">{auditCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'login'}
        className={'logs-tab-btn' + (activeTab === 'login' ? ' logs-tab-btn--active' : '')}
        onClick={() => onChange('login')}
      >
        <IconLogin />
        <span>Lich su dang nhap</span>
        <span className="logs-tab-btn__badge">{loginCount}</span>
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { to: '/admin/users', icon: <IconUsers />, label: 'Quan ly nguoi dung', desc: 'Xem & chinh sua tai khoan', accent: '#4f46e5' },
  { to: '/admin/users/create', icon: <IconUsers />, label: 'Them nguoi dung moi', desc: 'Tao tai khoan moi', accent: '#059669' },
  { to: '/admin/roles', icon: <IconRole />, label: 'Quan ly vai tro', desc: 'Phan quyen nguoi dung', accent: '#7c3aed' },
  { to: '/admin/logs', icon: <IconLog />, label: 'Nhat ky he thong', desc: 'Lich su thao tac', accent: '#d97706' },
  { to: '/profile/edit', icon: <IconTerminal />, label: 'Ho so ca nhan', desc: 'Chinh sua thong tin', accent: '#db2777' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginSessions, setLoginSessions] = useState([]);
  // Tab hien tai cua widget "Nhat ky". Mac dinh la activity (nhat ky hoat dong).
  const [logsTab, setLogsTab] = useState('activity');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsData, loginData] = await Promise.all([
          getAdminDashboardStats(),
          getRecentLoginSessions().catch(() => null),
        ]);
        if (!cancelled) {
          setStats(statsData);
          // loginData da duoc unwrap boi httpClient, la { items, total, page, pageSize }
          if (loginData?.items) {
            setLoginSessions(loginData.items);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Khong the tai thong ke');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chao buoi sang';
    if (h < 18) return 'Chao buoi chieu';
    return 'Chao buoi toi';
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
              Quan tri he thong
            </span>
            <span className="dash-header__email">{user?.email}</span>
            <span className="dash-header__date">{todayStr}</span>
          </div>
        </div>
        <div className="dash-header__right">
          <div className="dash-header__live-dot" />
          <span className="dash-header__live-label">Live</span>
          <span className="dash-header__update">
            Cap nhat: {stats?.generatedAt ? formatDateTime(stats.generatedAt) : '...'}
          </span>
        </div>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────── */}
      {loading && (
        <div className="dash-loading">
          <div className="dash-loading__spinner" />
          <span>Dang tai thong ke...</span>
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
              label="Tong nguoi dung"
              value={stats.totalUsers}
              sub={
                <span className="stat-chip-row">
                  <span className="stat-chip stat-chip--green">{stats.activeUsers} hoat dong</span>
                  <span className="stat-chip stat-chip--gray">{stats.inactiveUsers} ngung</span>
                  {stats.lockedUsers > 0 && (
                    <span className="stat-chip stat-chip--red">{stats.lockedUsers} bi khoa</span>
                  )}
                </span>
              }
            />
            <StatCard
              accent="#059669"
              icon={<IconBranch />}
              label="Chi nhanh"
              value={stats.totalBranches}
              sub="Dang hoat dong"
            />
            <StatCard
              accent="#7c3aed"
              icon={<IconRole />}
              label="Vai tro"
              value={stats.totalRoles}
              sub="Vai tro hien co"
            />
            <StatCard
              accent="#0891b2"
              icon={<IconLogin />}
              label="Dang nhap hom nay"
              value={stats.todayLogins}
              sub={`${stats.failedLogins} lan that bai`}
            />
          </div>

          {/* ── Row 2: Alerts + Logs Widget (with tabs) ────────────── */}
          <div className="dash-row-2">
            {/* Alerts widget */}
            <div className="dash-widget">
              <SectionHeader
                dot="linear-gradient(135deg, #ef4444, #f97316)"
                title="Thong bao he thong"
                badge={stats.alerts?.length || 0}
              />
              <div className="dash-widget__body">
                {stats.alerts && stats.alerts.length > 0 ? (
                  stats.alerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state__icon" style={{ color: '#10b981' }}>
                      <IconCheck />
                    </div>
                    <p>Tat ca hoat dong binh thuong</p>
                  </div>
                )}
              </div>
            </div>

            {/* Logs widget with tab switcher */}
            <div className="dash-widget">
              <div className="dash-widget__topbar">
                <LogsTabSwitcher
                  activeTab={logsTab}
                  onChange={setLogsTab}
                  auditCount={stats.recentLogs?.length || 0}
                  loginCount={loginSessions.length || stats.recentLogins?.length || 0}
                />
                <Link
                  to={logsTab === 'activity' ? '/admin/logs' : '/admin/logs/login'}
                  className="section-header__link"
                >
                  Xem tat ca <IconArrowRight />
                </Link>
              </div>

              {logsTab === 'activity' ? (
                <div className="dash-widget__body">
                  {stats.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => (
                      <ActivityItem key={log.id} log={log} />
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state__icon" style={{ color: '#94a3b8' }}>
                        <IconLog />
                      </div>
                      <p>Chua co nhat ky nao</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dash-widget__body">
                  {(loginSessions.length > 0 ? loginSessions : (stats.recentLogins || [])).length > 0 ? (
                    (loginSessions.length > 0 ? loginSessions : stats.recentLogins).map((item) => (
                      <LoginItem key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state__icon" style={{ color: '#94a3b8' }}>
                        <IconLogin />
                      </div>
                      <p>Chua co lich su dang nhap</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 3: Quick Actions ──────────────────────────────── */}
          <div className="dash-row-2">
            <div className="dash-widget dash-widget--span-2">
              <SectionHeader
                dot="linear-gradient(135deg, #4f46e5, #7c3aed)"
                title="Thao tac nhanh"
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
