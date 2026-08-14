import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import ScrollToggleButton from '../common/ScrollToggleButton';
import UserProfileMenu from './UserProfileMenu';
import NotificationBell from '../NotificationBell';
import { adminSecurityAlertsApi } from '../../services/adminApi';
import { SECURITY_ALERTS_COUNT_EVENT } from '../../utils/securityAlertEvents';
import { forceCrmBrowserUrl, navigateWithCrm } from '../../utils/crmUrl';
import './AdminLayout.css';

const ADMIN_SIDEBAR = [
  {
    group: null,
    items: [
      {
        label: 'Tổng quan',
        path: '/admin/dashboard',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Hệ thống',
    items: [
      {
        label: 'Người dùng',
        path: '/admin/users',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
        badge: null,
      },
      {
        label: 'Danh mục hệ thống',
        path: '/admin/catalog',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Giám sát',
    items: [
      {
        label: 'Bảo mật đăng nhập',
        path: '/admin/login-security',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        countKey: 'securityAlerts',
      },
      {
        label: 'Nhật ký hoạt động',
        path: '/admin/logs',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Tài khoản',
    items: [
      {
        label: 'Tài khoản của tôi',
        path: '/admin/profile',
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
    ],
  },
];

function AdminSidebar({
  isMobileOpen,
  onClose,
  onItemClick,
  onNavStart,
  onNavEnd,
  onContentRefresh,
}) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function urgentFrom(data) {
      if (!data || typeof data !== 'object') return 0;
      return (Number(data.critical) || 0) + (Number(data.high) || 0);
    }

    async function loadCounts() {
      try {
        const data = await adminSecurityAlertsApi.getCounts();
        if (!cancelled) setAlertCount(urgentFrom(data));
      } catch {
        if (!cancelled) setAlertCount(0);
      }
    }
    loadCounts();
    const t = setInterval(loadCounts, 60_000);

    const onCountChanged = (e) => {
      const detail = e?.detail;
      if (detail && typeof detail === 'object' && ('critical' in detail || 'high' in detail)) {
        setAlertCount(urgentFrom(detail));
        return;
      }
      loadCounts();
    };
    window.addEventListener(SECURITY_ALERTS_COUNT_EVENT, onCountChanged);

    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener(SECURITY_ALERTS_COUNT_EVENT, onCountChanged);
    };
  }, [location.pathname]);

  const countMap = { securityAlerts: alertCount };

  const visibleGroups = ADMIN_SIDEBAR.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.hidden),
  })).filter((g) => g.items.length > 0);
  const allItems = visibleGroups.flatMap((g) => g.items);
  const matchedPaths = allItems
    .filter(
      (i) =>
        location.pathname === i.path ||
        (i.path !== '/admin/dashboard' && location.pathname.startsWith(i.path + '/'))
    )
    .map((i) => i.path)
    .sort((a, b) => b.length - a.length);
  const longestMatch = matchedPaths[0];

  // SPA navigate nhanh — không full reload (tránh trắng màn hình lâu)
  const handleItemClick = (targetPath) => {
    if (onItemClick) onItemClick();
    if (!targetPath) return;
    const samePage = targetPath === location.pathname;
    onNavStart?.();
    if (!samePage) {
      navigateWithCrm(navigate, targetPath);
    }
    // Chỉ soft-remount khi click lại đúng trang hiện tại (làm mới state).
    // Đổi trang: React Router đã mount page mới — remount thêm chỉ hủy API đang chạy.
    if (samePage) {
      onContentRefresh?.();
    }
    requestAnimationFrame(() => {
      setTimeout(() => onNavEnd?.(), 180);
    });
  };

  return (
    <aside className={`admin-sidebar${isMobileOpen ? ' admin-sidebar--mobile-open' : ''}`}>
      {/* Brand */}
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__logo">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </div>
        <div className="admin-sidebar__brand-text">
          <span className="admin-sidebar__brand-name">AutoGara</span>
          <span className="admin-sidebar__brand-role">{user?.role || 'Quản trị hệ thống'}</span>
        </div>
        {isMobileOpen && (
          <button
            type="button"
            className="admin-sidebar__close"
            onClick={onClose}
            aria-label="Đóng menu"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <nav className="admin-sidebar__nav">
        {visibleGroups.map((group, gi) => (
          <div key={gi} className="admin-sidebar__group">
            {group.group && <div className="admin-sidebar__group-label">{group.group}</div>}
            {group.items.map((item) => {
              const isActive = item.path === longestMatch;
              const count = item.countKey ? countMap[item.countKey] : 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={() =>
                    `admin-sidebar__item ${isActive ? 'admin-sidebar__item--active' : ''}`
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(item.path);
                  }}
                >
                  <span className="admin-sidebar__item-icon">{item.icon}</span>
                  <span className="admin-sidebar__item-label">{item.label}</span>
                  {item.badge && <span className="admin-sidebar__item-badge">{item.badge}</span>}
                  {count > 0 && (
                    <span className="admin-sidebar__item-count">{count > 100 ? '99+' : count}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const adminHistoryRef = useRef([]);
  const adminHistoryIndexRef = useRef(-1);
  const pendingHistoryJumpRef = useRef(null);
  const remountOnHistoryJumpRef = useRef(false);

  // Clear leftover dark-theme preference (admin luôn dùng light)
  useEffect(() => {
    try {
      localStorage.removeItem('admin-theme');
    } catch {
      /* ignore */
    }
    document.documentElement.removeAttribute('data-theme');
  }, []);

  const refreshContent = () => {
    setContentKey((k) => k + 1);
  };

  const getLocationEntry = () => ({
    navKey: location.key || `${Date.now()}-${Math.random()}`,
    url: `${location.pathname}${location.search}${location.hash}`,
  });

  const syncAdminHistoryState = () => {
    const entry = getLocationEntry();
    const key = entry.url;
    const isAdminRoute = String(location.pathname).startsWith('/admin');
    if (!isAdminRoute) return;

    const stack = adminHistoryRef.current;
    const pending = pendingHistoryJumpRef.current;
    if (pending && pending.url === key) {
      adminHistoryIndexRef.current = pending.index;
      pendingHistoryJumpRef.current = null;
      setCanGoBack(pending.index > 0);
      setCanGoForward(pending.index < stack.length - 1);
      if (remountOnHistoryJumpRef.current) {
        refreshContent();
        remountOnHistoryJumpRef.current = false;
      }
      return;
    }

    const indexByNavKey = stack.findIndex((item) => item.navKey === entry.navKey);
    if (indexByNavKey >= 0) {
      adminHistoryIndexRef.current = indexByNavKey;
      setCanGoBack(indexByNavKey > 0);
      setCanGoForward(indexByNavKey < stack.length - 1);
      return;
    }

    const index = adminHistoryIndexRef.current;
    const currentItem = index >= 0 ? stack[index] : null;
    if (currentItem && currentItem.url === key) {
      setCanGoBack(index > 0);
      setCanGoForward(index < stack.length - 1);
      return;
    }

    const nextStack = stack.slice(0, index + 1);
    nextStack.push(entry);
    adminHistoryRef.current = nextStack;
    adminHistoryIndexRef.current = nextStack.length - 1;
    setCanGoBack(nextStack.length > 1);
    setCanGoForward(false);
  };

  const visibleGroups = ADMIN_SIDEBAR.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.hidden),
  })).filter((g) => g.items.length > 0);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll khi mobile drawer mo
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
    return undefined;
  }, [mobileOpen]);

  useEffect(() => {
    syncAdminHistoryState();
    // Mọi lần đổi route trong admin: ép lại /crm trên thanh địa chỉ
    if (String(location.pathname).startsWith('/admin')) {
      forceCrmBrowserUrl(location.pathname, location.search, location.hash);
    }
  }, [location.pathname, location.search, location.hash, location.key]);

  const handleGoBack = () => {
    const stack = adminHistoryRef.current;
    const index = adminHistoryIndexRef.current;
    if (index <= 0) return;

    const targetIndex = index - 1;
    const target = stack[targetIndex];
    if (!target) return;
    pendingHistoryJumpRef.current = { index: targetIndex, url: target.url };
    remountOnHistoryJumpRef.current = true;
    adminHistoryIndexRef.current = targetIndex;
    setCanGoBack(targetIndex > 0);
    setCanGoForward(true);
    navigateWithCrm(navigate, target.url, { replace: true });
  };

  const handleGoForward = () => {
    const stack = adminHistoryRef.current;
    const index = adminHistoryIndexRef.current;
    if (index < 0 || index >= stack.length - 1) return;

    const targetIndex = index + 1;
    const target = stack[targetIndex];
    if (!target) return;
    pendingHistoryJumpRef.current = { index: targetIndex, url: target.url };
    remountOnHistoryJumpRef.current = true;
    adminHistoryIndexRef.current = targetIndex;
    setCanGoBack(targetIndex > 0);
    setCanGoForward(targetIndex < stack.length - 1);
    navigateWithCrm(navigate, target.url, { replace: true });
  };

  const allItems = visibleGroups.flatMap((g) => g.items);
  const matchedPaths = allItems
    .filter(
      (i) =>
        location.pathname === i.path ||
        (i.path !== '/admin/dashboard' && location.pathname.startsWith(i.path + '/'))
    )
    .map((i) => i.path)
    .sort((a, b) => b.length - a.length);
  const longestMatch = matchedPaths[0];
  const currentPage = allItems.find((i) => i.path === longestMatch);

  return (
    <div className={`admin-shell ${collapsed ? 'admin-shell--collapsed' : ''}`}>
      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="admin-sidebar__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (desktop + mobile drawer) */}
      <AdminSidebar
        isMobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onItemClick={() => setMobileOpen(false)}
        onNavStart={() => setNavLoading(true)}
        onNavEnd={() => setNavLoading(false)}
        onContentRefresh={refreshContent}
      />

      {navLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(248, 250, 252, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid #c7d2fe',
              borderTopColor: '#4f46e5',
              animation: 'admin-nav-spin 0.7s linear infinite',
            }}
          />
          <style>{`@keyframes admin-nav-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Desktop collapse button (desktop only) */}
      <button
        type="button"
        className="admin-shell__collapse-toggle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      {/* Main */}
      <div className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            {/* Hamburger - chi hien tren mobile */}
            <button
              type="button"
              className="admin-topbar__hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="admin-topbar__breadcrumb">
              <div className="admin-topbar__history-nav">
                <button
                  type="button"
                  className="admin-topbar__history-btn"
                  onClick={handleGoBack}
                  aria-label="Quay lại trang trước"
                  title="Quay lại trang trước"
                  disabled={!canGoBack}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="admin-topbar__history-btn"
                  onClick={handleGoForward}
                  aria-label="Đi tới trang sau"
                  title="Đi tới trang sau"
                  disabled={!canGoForward}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
              <span className="admin-topbar__section">Quản trị</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="admin-topbar__page">{currentPage?.label || 'Trang'}</span>
            </div>
          </div>

          <div className="admin-topbar__right">
            <NotificationBell />
            <UserProfileMenu />
          </div>
        </header>

        <main className="admin-content">
          {/* Không gắn location.search vào key: đổi ?alerts= / ?tab= sẽ remount
              và xóa state popup (vd. Chi tiết lịch sử). Remount chủ đích dùng contentKey. */}
          <div
            key={`${location.pathname}${location.hash}::${contentKey}`}
            className="admin-content__remount"
          >
            {children}
          </div>
        </main>

        <ScrollToggleButton />
      </div>
    </div>
  );
}
