import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { usePermission } from '../../contexts';
import ScrollToggleButton from '../common/ScrollToggleButton';
import './AdminLayout.css';

const ADMIN_SIDEBAR = [
  {
    group: null,
    items: [
      {
        label: 'Tổng quan',
        path: '/admin/dashboard',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
        badge: 'Hệ thống',
        permission: 'screen:users:access',
      },
      {
        label: 'Chi nhánh',
        path: '/admin/branches',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
        permission: 'screen:branches:access',
      },
      {
        label: 'Chuyên môn',
        path: '/admin/specialties',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        ),
        permission: 'screen:specialties:access',
      },
    ],
  },
  {
    group: 'Giám sát',
    items: [
      {
        label: 'Ma trận quyền',
        path: '/admin/permission-matrix',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
        ),
        permission: 'screen:permission_matrix:access',
      },
      {
        label: 'Nhật ký hoạt động',
        path: '/admin/logs',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        ),
        permission: 'screen:audit_logs:access',
      },
      {
        label: 'Lịch sử đăng nhập',
        path: '/admin/login-sessions',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        ),
        permission: 'screen:login_sessions:access',
      },
      {
        label: 'Thiết bị',
        path: '/admin/devices',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        ),
        permission: 'screen:devices:access',
      },
    ],
  },
  {
    group: 'Tài khoản',
    items: [
      {
        label: 'Hồ sơ cá nhân',
        path: '/admin/profile',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
      {
        label: 'Cài đặt thông báo',
        path: '/admin/profile/notifications',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a1.94 1.94 0 0 1-3.46 0"/>
          </svg>
        ),
      },
    ],
  },
];

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AdminSidebar({ isMobileOpen, onClose, onItemClick, onNavStart, onNavEnd, onContentRefresh }) {
  const { user } = useAuth();
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const isItemVisible = (item) => !item.permission || can(item.permission);

  const visibleGroups = ADMIN_SIDEBAR
    .map((g) => ({ ...g, items: g.items.filter(isItemVisible) }))
    .filter((g) => g.items.length > 0);
  const allItems = visibleGroups.flatMap((g) => g.items);
  const matchedPaths = allItems
    .filter((i) =>
      location.pathname === i.path
      || (i.path !== '/admin/dashboard' && location.pathname.startsWith(i.path + '/'))
    )
    .map((i) => i.path)
    .sort((a, b) => b.length - a.length);
  const longestMatch = matchedPaths[0];

  // SPA navigate nhanh — không full reload (tránh trắng màn hình lâu)
  const handleItemClick = (targetPath) => {
    if (onItemClick) onItemClick();
    if (!targetPath) return;
    onNavStart?.();
    // Cùng trang hoặc đổi trang: luôn remount content (soft F5) để state sạch
    if (targetPath !== location.pathname) {
      navigate(targetPath);
    }
    onContentRefresh?.();
    requestAnimationFrame(() => {
      setTimeout(() => onNavEnd?.(), 180);
    });
  };

  return (
    <aside className={`admin-sidebar${isMobileOpen ? ' admin-sidebar--mobile-open' : ''}`}>
      {/* Brand */}
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      <nav className="admin-sidebar__nav">
        {visibleGroups.map((group, gi) => (
          <div key={gi} className="admin-sidebar__group">
            {group.group && (
              <div className="admin-sidebar__group-label">{group.group}</div>
            )}
            {group.items.map((item) => {
              const isActive = item.path === longestMatch;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={() => `admin-sidebar__item ${isActive ? 'admin-sidebar__item--active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(item.path);
                  }}
                >
                  <span className="admin-sidebar__item-icon">{item.icon}</span>
                  <span className="admin-sidebar__item-label">{item.label}</span>
                  {item.badge && <span className="admin-sidebar__item-badge">{item.badge}</span>}
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
  const { user, logout } = useAuth();
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const userMenuRef = useRef(null);
  const prevPathRef = useRef(location.pathname);

  // Clear leftover dark-theme preference (admin luôn dùng light)
  useEffect(() => {
    try { localStorage.removeItem('admin-theme'); } catch { /* ignore */ }
    document.documentElement.removeAttribute('data-theme');
  }, []);

  const refreshContent = () => {
    setContentKey((k) => k + 1);
  };

  const isItemVisible = (item) => !item.permission || can(item.permission);
  const visibleGroups = ADMIN_SIDEBAR
    .map((g) => ({ ...g, items: g.items.filter(isItemVisible) }))
    .filter((g) => g.items.length > 0);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Khi vừa login và điều hướng từ trang public (/login) vào admin,
  // ép remount nội dung để tránh render sai frame (cần F5 mới đúng).
  useEffect(() => {
    const prev = prevPathRef.current;
    const now = location.pathname;
    prevPathRef.current = now;

    const nowAdmin = String(now).startsWith('/admin');
    const prevAdmin = String(prev).startsWith('/admin');
    if (nowAdmin && !prevAdmin) {
      refreshContent();
    }
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
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    // AppContext.logout() da tu goi window.location.assign('/login') -> reload
    // toan trang, dam bao state sach 100%. Khong can navigate o day.
    await logout();
  };

  const handleProfileClick = () => {
    setUserMenuOpen(false);
    navigate('/admin/profile');
  };

  const allItems = visibleGroups.flatMap((g) => g.items);
  const matchedPaths = allItems
    .filter((i) =>
      location.pathname === i.path
      || (i.path !== '/admin/dashboard' && location.pathname.startsWith(i.path + '/'))
    )
    .map((i) => i.path)
    .sort((a, b) => b.length - a.length);
  const longestMatch = matchedPaths[0];
  const currentPage = allItems.find((i) => i.path === longestMatch);

  return (
    <div
      className={`admin-shell ${collapsed ? 'admin-shell--collapsed' : ''}`}
    >

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? (
            <polyline points="9 18 15 12 9 6"/>
          ) : (
            <polyline points="15 18 9 12 15 6"/>
          )}
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <div className="admin-topbar__breadcrumb">
              <span className="admin-topbar__section">Quản trị</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="admin-topbar__page">{currentPage?.label || 'Trang'}</span>
            </div>
          </div>

          <div className="admin-topbar__right">
            {user && (
              <div className="admin-topbar__online-indicator" title="Tài khoản đang hoạt động">
                <span className="online-dot" />
                <span className="online-label admin-topbar__online-label">Trực tuyến</span>
              </div>
            )}
            <div className="admin-topbar__user" onClick={() => setUserMenuOpen((v) => !v)} ref={userMenuRef}>
              <div className="admin-topbar__avatar">{getInitials(user?.name || '')}</div>
              <div className="admin-topbar__user-info">
                <span className="admin-topbar__user-name">{user?.name}</span>
                <span className="admin-topbar__user-role">Quản trị viên</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>

              {userMenuOpen && (
                <div className="admin-topbar__dropdown">
                  <div className="admin-topbar__dropdown-header">
                    <div className="admin-topbar__dropdown-avatar">{getInitials(user?.name || '')}</div>
                    <div>
                      <div className="admin-topbar__dropdown-name">{user?.name}</div>
                      <div className="admin-topbar__dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="admin-topbar__dropdown-divider"/>
                  <button
                    className="admin-topbar__dropdown-item"
                    onClick={handleProfileClick}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Hồ sơ cá nhân
                  </button>
                  <button className="admin-topbar__dropdown-item admin-topbar__dropdown-item--danger" onClick={handleLogout}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content">
          <div key={`${location.pathname}::${contentKey}`} className="admin-content__remount">
            {children}
          </div>
        </main>

        <ScrollToggleButton />
      </div>
    </div>
  );
}
