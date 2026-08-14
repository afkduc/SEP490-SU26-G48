import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { getAdminDashboardStats, adminSecurityAlertsApi } from '../../services/adminApi';
import { getNotifications } from '../../services/notificationApi';
import { humanizeNotificationMessage } from '../../utils/notificationDisplay';
import { SECURITY_ALERTS_COUNT_EVENT } from '../../utils/securityAlertEvents';
import DateRangeInputs from '../../components/common/DateRangeInputs';
import {
  IconUsers,
  IconBranch,
  IconRole,
  IconLogin,
  IconLog,
  IconAlert,
  IconCheck,
  IconArrowRight,
  IconTerminal,
} from './components/AdminDashboardIcons';
import {
  formatDateTime,
  generateAlertsFromStats,
  buildCombinedActivity,
  collapseDashboardAlerts,
} from './components/adminDashboardFormatters';
import {
  StatCard,
  SectionHeader,
  AlertItem,
  ActivityItem,
  LoginItem,
  QuickAction,
} from './components/AdminDashboardWidgets';
import './AdminDashboardPage.css';

// ─── Main component ─────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    to: '/admin/users',
    icon: <IconUsers />,
    label: 'Quản lý người dùng',
    desc: 'Xem, chỉnh sửa & phân quyền',
    accent: '#4f46e5',
  },
  {
    to: '/admin/login-security',
    icon: <IconAlert />,
    label: 'Bảo mật đăng nhập',
    desc: 'Thiết bị + tín hiệu cảnh báo',
    accent: '#ef4444',
  },
  {
    to: '/admin/logs',
    icon: <IconLog />,
    label: 'Nhật ký hoạt động',
    desc: 'Lịch sử thao tác',
    accent: '#d97706',
  },
  {
    to: '/admin/catalog',
    icon: <IconLogin />,
    label: 'Danh mục hệ thống',
    desc: 'Chi nhánh',
    accent: '#0891b2',
  },
  {
    to: '/admin/profile',
    icon: <IconTerminal />,
    label: 'Tài khoản của tôi',
    desc: 'Hồ sơ & thông báo',
    accent: '#db2777',
  },
];

export default function AdminDashboardPage() {
  const { user, permissions } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [periodPreset, setPeriodPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  function resolvePeriodRange(preset, fromVal, toVal) {
    const today = new Date();
    const yyyyMmDd = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (preset === 'custom') {
      return { fromDate: fromVal || undefined, toDate: toVal || undefined };
    }
    if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { fromDate: yyyyMmDd(start), toDate: yyyyMmDd(today) };
    }
    if (preset === 'year') {
      const start = new Date(today.getFullYear(), 0, 1);
      return { fromDate: yyyyMmDd(start), toDate: yyyyMmDd(today) };
    }
    // today
    const d = yyyyMmDd(today);
    return { fromDate: d, toDate: d };
  }

  const periodLabel = (() => {
    if (periodPreset === 'today') return 'Hôm nay';
    if (periodPreset === 'month') return 'Tháng này';
    if (periodPreset === 'year') return 'Năm nay';
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    return 'Tùy chọn';
  })();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const range = resolvePeriodRange(periodPreset, customFrom, customTo);
        if (periodPreset === 'custom' && (!range.fromDate || !range.toDate)) {
          if (!cancelled) setLoading(false);
          return;
        }
        const statsData = await getAdminDashboardStats(range);
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
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodPreset, customFrom, customTo]);

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
      // Không ghi đè số cảnh báo theo khoảng lọc trên dashboard (B1).
      // Counts toàn cục vẫn xem tại tab Bảo mật đăng nhập.
      void counts;
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
    const autoAlerts =
      backendAlerts.length === 0 && notifications.length === 0
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
  const combinedActivity = stats
    ? buildCombinedActivity(stats.recentLogs || [], stats.recentLogins || [])
    : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
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
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Quản trị hệ thống
            </span>
            <span className="dash-header__email">{user?.email}</span>
            <span className="dash-header__date">{todayStr}</span>
          </div>
        </div>
        <div className="dash-header__right">
          <div className="dash-header__live-dot" />
          <span className="dash-header__live-label">Trực tiếp</span>
          <span className="dash-header__update">
            Cập nhật: {stats?.generatedAt ? formatDateTime(stats.generatedAt) : '...'}
          </span>
        </div>
      </div>

      <div
        className="dash-period-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 16,
          padding: '12px 16px',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
          Thống kê IAM / bảo mật — khoảng:
        </span>
        {[
          { id: 'today', label: 'Hôm nay' },
          { id: 'month', label: 'Tháng này' },
          { id: 'year', label: 'Năm nay' },
          { id: 'custom', label: 'Tùy chọn' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn btn--sm ${periodPreset === p.id ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setPeriodPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        {periodPreset === 'custom' && (
          <DateRangeInputs
            startDate={customFrom}
            endDate={customTo}
            onChange={({ startDate, endDate }) => {
              setCustomFrom(startDate);
              setCustomTo(endDate);
            }}
            className="dash-period__dates"
            inputClassName="input"
            sep="→"
          />
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
          Đang xem: <strong>{periodLabel}</strong>
          {stats?.periodAuditCount != null ? ` · ${stats.periodAuditCount} nhật ký` : ''}
        </span>
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
              label={`Đăng nhập (${periodLabel})`}
              value={stats.todayLogins}
              sub={`${stats.failedLogins} lần thất bại trong khoảng`}
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
                  Có <strong>{urgent > 99 ? '99+' : urgent}</strong> cảnh báo bảo mật cần xử lý{' '}
                  (Nghiêm trọng {critical} · Cao {high})
                </span>
                <span className="dash-alert-banner__link">
                  Xem và xử lý <IconArrowRight />
                </span>
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
                  derivedAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)
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
                  <Link
                    to="/admin/login-security?tab=sessions"
                    className="section-header__link section-header__link--alt"
                  >
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
