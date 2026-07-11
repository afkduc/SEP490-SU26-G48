import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getAdminDashboardStats } from '../../services/adminApi';
import './AdminDashboardPage.css';

const ACTION_TILES = [
  {
    to: '/admin/users',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: 'Nguoi dung',
    desc: 'Xem & quan ly tai khoan',
    accent: '#4f46e5',
  },
  {
    to: '/admin/users/create',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
    label: 'Them nguoi dung',
    desc: 'Tao tai khoan moi',
    accent: '#059669',
  },
  {
    to: '/admin/roles',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    label: 'Vai tro',
    desc: 'Xem & phan quyen',
    accent: '#7c3aed',
  },
  {
    to: '/admin/logs',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    label: 'Nhat ky',
    desc: 'Lich su thao tac',
    accent: '#d97706',
  },
  {
    to: '/admin/logs/login',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    label: 'Lich su dang nhap',
    desc: 'Kiem tra phien hoat dong',
    accent: '#0891b2',
  },
  {
    to: '/profile/edit',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93l-1.41 1.41"/>
        <path d="M4.93 4.93l1.41 1.41"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="M4.93 19.07l1.41-1.41"/>
        <path d="M19.07 19.07l-1.41-1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
      </svg>
    ),
    label: 'Thong tin ca nhan',
    desc: 'Chinh sua ho so',
    accent: '#db2777',
  },
];

const QUICK_LINKS = [
  { label: 'Danh sach nguoi dung', to: '/admin/users' },
  { label: 'Tao nguoi dung moi', to: '/admin/users/create' },
  { label: 'Quan ly vai tro', to: '/admin/roles' },
  { label: 'Xem nhat ky he thong', to: '/admin/logs' },
  { label: 'Lich su dang nhap', to: '/admin/logs/login' },
  { label: 'Chinh sua ho so', to: '/profile/edit' },
];

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

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

const ACTION_ICON_COLORS = {
  CREATE_USER: '#059669',
  UPDATE_USER: '#4f46e5',
  DELETE_USER: '#dc2626',
  LOGIN: '#0891b2',
  LOGIN_FAILED: '#dc2626',
  ASSIGN_ROLE: '#7c3aed',
  REVOKE_ROLE: '#d97706',
  CHANGE_PASSWORD: '#db2777',
  UPDATE_PROFILE: '#059669',
};

function getActionColor(action) {
  for (const [key, color] of Object.entries(ACTION_ICON_COLORS)) {
    if (action && action.toUpperCase().includes(key)) return color;
  }
  return '#6b7280';
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-card__icon-wrap">
        {icon}
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value ?? '—'}</div>
        <div className="stat-card__label">{label}</div>
        {sub && <div className="stat-card__sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminDashboardStats();
        if (!cancelled) setStats(data);
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

  return (
    <div className="admin-dashboard">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="dash-header">
        <div className="dash-header__left">
          <h1 className="dash-header__title">
            {greeting}, <span className="dash-header__name">{user?.name}</span>
          </h1>
          <p className="dash-header__sub">
            Quan tri he thong &bull; {user?.email}
            {stats?.generatedAt && (
              <span className="dash-header__time">
                Cap nhat: {formatDateTime(stats.generatedAt)}
              </span>
            )}
          </p>
        </div>
        <div className="dash-header__badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Quan tri vien
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────── */}
      {stats && !loading && (
        <>
          {/* ── Stats grid ─────────────────────────────────────── */}
          <div className="dash-stats-grid">
            <StatCard
              accent="#4f46e5"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              }
              label="Nguoi dung he thong"
              value={stats.totalUsers}
              sub={
                <span className="stat-card__sub-row">
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
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              }
              label="Chi nhanh"
              value={stats.totalBranches}
              sub="Dang hoat dong"
            />
            <StatCard
              accent="#7c3aed"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              }
              label="Vai tro"
              value={stats.totalRoles}
              sub="Vai tro hien co"
            />
            <StatCard
              accent="#0891b2"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              }
              label="Hoat dong gan day"
              value={stats.recentLogs?.length || 0}
              sub="Bản ghi nhat ky"
            />
          </div>

          {/* ── Two-column: actions + recent logs ───────────────── */}
          <div className="dash-two-col">
            {/* Quick actions */}
            <div className="dash-card">
              <div className="dash-card__header">
                <span className="dash-card__title-dot" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} />
                <h2 className="dash-card__title">Thao tac nhanh</h2>
              </div>
              <div className="action-tiles-grid">
                {ACTION_TILES.map((tile) => (
                  <Link key={tile.to} to={tile.to} className="action-tile" style={{ '--tile-accent': tile.accent }}>
                    <div className="action-tile__icon">{tile.icon}</div>
                    <div className="action-tile__text">
                      <span className="action-tile__label">{tile.label}</span>
                      <span className="action-tile__desc">{tile.desc}</span>
                    </div>
                    <div className="action-tile__arrow">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="dash-card">
              <div className="dash-card__header">
                <span className="dash-card__title-dot" style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }} />
                <h2 className="dash-card__title">Hoat dong gan day</h2>
                <Link to="/admin/logs" className="dash-card__see-all">Xem tat ca</Link>
              </div>
              {stats.recentLogs && stats.recentLogs.length > 0 ? (
                <div className="activity-list">
                  {stats.recentLogs.map((log) => (
                    <div key={log.id} className="activity-item">
                      <div
                        className="activity-item__dot"
                        style={{ background: getActionColor(log.action) }}
                      />
                      <div className="activity-item__body">
                        <div className="activity-item__action">
                          <span className="activity-item__badge" style={{ background: getActionColor(log.action) + '18', color: getActionColor(log.action) }}>
                            {log.action || 'UNKNOWN'}
                          </span>
                          <span className="activity-item__actor">{log.actorName || 'He thong'}</span>
                        </div>
                        {log.details && (
                          <div className="activity-item__details">{log.details}</div>
                        )}
                        <div className="activity-item__meta">
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                          <span>{formatRelativeTime(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="activity-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p>Chua co nhat ky nao</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom row: quick links ─────────────────────────── */}
          <div className="dash-card">
            <div className="dash-card__header">
              <span className="dash-card__title-dot" style={{ background: 'linear-gradient(135deg, #d97706, #db2777)' }} />
              <h2 className="dash-card__title">Truy cap nhanh</h2>
            </div>
            <div className="quick-links-grid">
              {QUICK_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="quick-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
