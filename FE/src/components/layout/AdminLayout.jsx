import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import './AdminLayout.css';

const ADMIN_SIDEBAR = [
  {
    group: null,
    items: [
      {
        label: 'Tong quan',
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
    group: 'He thong',
    items: [
      {
        label: 'Nguoi dung',
        path: '/admin/users',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
        badge: 'He thong',
      },
      {
        label: 'Vai tro',
        path: '/admin/roles',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Nhat ky',
    items: [
      {
        label: 'Nhat ky hoat dong',
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
      },
      {
        label: 'Lich su dang nhap',
        path: '/admin/logs/login',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentPage = ADMIN_SIDEBAR.flatMap((g) => g.items).find((item) =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className={`admin-shell ${collapsed ? 'admin-shell--collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="admin-sidebar__brand-text">
              <span className="admin-sidebar__brand-name">AutoGara</span>
              <span className="admin-sidebar__brand-role">Quan tri he thong</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="admin-sidebar__nav">
          {ADMIN_SIDEBAR.map((group, gi) => (
            <div key={gi} className="admin-sidebar__group">
              {group.group && !collapsed && (
                <div className="admin-sidebar__group-label">{group.group}</div>
              )}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`admin-sidebar__item ${isActive ? 'admin-sidebar__item--active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="admin-sidebar__item-icon">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="admin-sidebar__item-label">{item.label}</span>
                        {item.badge && <span className="admin-sidebar__item-badge">{item.badge}</span>}
                      </>
                    )}
                    {collapsed && (
                      <span className="admin-sidebar__item-tooltip">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="admin-sidebar__footer">
          <button
            className="admin-sidebar__collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Mo rong sidebar' : 'Thu gon sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6"/>
              ) : (
                <polyline points="15 18 9 12 15 6"/>
              )}
            </svg>
            {!collapsed && <span>Thu gon</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar__breadcrumb">
            <span className="admin-topbar__section">Quan tri</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="admin-topbar__page">{currentPage?.label || 'Trang'}</span>
          </div>

          <div className="admin-topbar__right">
            <div className="admin-topbar__user" onClick={() => setUserMenuOpen((v) => !v)}>
              <div className="admin-topbar__avatar">{getInitials(user?.name || '')}</div>
              <div className="admin-topbar__user-info">
                <span className="admin-topbar__user-name">{user?.name}</span>
                <span className="admin-topbar__user-role">Quan tri vien</span>
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
                  <button className="admin-topbar__dropdown-item admin-topbar__dropdown-item--danger" onClick={handleLogout}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Dang xuat
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
