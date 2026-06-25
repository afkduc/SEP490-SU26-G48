import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import './Navbar.css';

const DEFAULT_NAV = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Quyết toán sửa chữa', path: '/repair-settlement' },
  { label: 'Bảo dưỡng', path: '/maintenance' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
  { label: 'Dịch vụ', path: '/services' },
];

const NAV_ITEMS_BY_ROLE = {
  admin: DEFAULT_NAV,
  general_director: DEFAULT_NAV,
  manager: DEFAULT_NAV,
  service_advisor: DEFAULT_NAV,
  warehouse_staff: DEFAULT_NAV,
  accountant: DEFAULT_NAV,
};

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = NAV_ITEMS_BY_ROLE[user?.primaryRole] ?? DEFAULT_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = getInitials(user?.name || '');
  const roleLabel = user?.primaryRoleLabel || user?.primaryRole || '';
  const displayName = user?.lastName || user?.name?.split(' ').pop() || '';

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <div className="navbar__logo">🚗</div>
        <span className="navbar__name">AutoGara</span>
      </div>

      <nav className="navbar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              'navbar__link' + (isActive ? ' navbar__link--active' : '')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar__right">
        {roleLabel && <span className="navbar__role-badge">{roleLabel}</span>}

        <div className="navbar__user" onClick={() => setDropdownOpen((v) => !v)}>
          <div className="navbar__avatar">{initials}</div>
          <span className="navbar__display-name">{displayName}</span>
          <span className="navbar__caret">▼</span>
        </div>

        {dropdownOpen && (
          <div className="navbar__dropdown">
            <div className="navbar__dropdown-header">
              <p className="navbar__dropdown-name">{user?.name}</p>
              <p className="navbar__dropdown-email">{user?.email}</p>
            </div>
            <hr />
            <button className="navbar__dropdown-item" onClick={handleLogout}>
              🚪 Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
