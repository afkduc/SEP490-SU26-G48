import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import './Navbar.css';

const DEFAULT_NAV = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Kho', path: '/inventory' },
  { label: 'Quyết toán sửa chữa', path: '/repair-settlement' },
  { label: 'Bảo dưỡng', path: '/maintenance' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
  { label: 'Dịch vụ', path: '/services' },
];

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Admin', path: '/admin/dashboard', icon: '🛡️' },
  { label: 'Kho', path: '/inventory' },
  { label: 'Quyết toán sửa chữa', path: '/repair-settlement' },
  { label: 'Bảo dưỡng', path: '/maintenance' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
  { label: 'Dịch vụ', path: '/services' },
];

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Admin', path: '/admin/dashboard', icon: '🛡️' },
  { label: 'Quyết toán sửa chữa', path: '/repair-settlement' },
  { label: 'Bảo dưỡng', path: '/maintenance' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
  { label: 'Dịch vụ', path: '/services' },
];

const SERVICE_ADVISOR_NAV = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: '📊',
  },
  {
    label: 'Quyết toán sửa chữa',
    icon: '📋',
    children: [
      { label: 'Danh sách quyết toán', path: '/repair-settlement' },
      { label: 'Tạo quyết toán', path: '/repair-settlement/create' },
    ],
  },
  {
    label: 'Lệnh sửa chữa',
    icon: '🔧',
    children: [
      { label: 'Danh sách lệnh sửa chữa', path: '/repair-orders' },
      { label: 'Tạo lệnh sửa chữa', path: '/repair-orders/create' },
    ],
  },
  {
    label: 'Chăm sóc khách hàng',
    icon: '💚',
    children: [
      { label: 'Lịch hẹn', path: '/customer-care/appointments' },
      { label: 'Nhắc nhở', path: '/customer-care/reminders' },
    ],
  },
  {
    label: 'Khách hàng',
    icon: '👤',
    children: [
      { label: 'Danh sách khách hàng', path: '/customers' },
      { label: 'Thêm khách hàng', path: '/customers/create' },
    ],
  },
];

const NAV_ITEMS_BY_ROLE = {
  [ROLES.ADMIN]: ADMIN_NAV,
  general_director: DEFAULT_NAV,
  manager: DEFAULT_NAV,
  service_advisor: SERVICE_ADVISOR_NAV,
  warehouse_staff: DEFAULT_NAV,
  accountant: DEFAULT_NAV,
};

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function NavDropdownItem({ item }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          'navbar__link' + (isActive ? ' navbar__link--active' : '')
        }
      >
        {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
        {item.label}
      </NavLink>
    );
  }

  return (
    <div
      className="navbar__dropdown-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className="navbar__link navbar__link-btn">
        {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
        {item.label}
        <span className="navbar__link-caret">▼</span>
      </button>

      {open && (
        <div className="navbar__nav-dropdown">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                'navbar__nav-dropdown-item' + (isActive ? ' navbar__nav-dropdown-item--active' : '')
              }
              onClick={() => setOpen(false)}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = NAV_ITEMS_BY_ROLE[user?.primaryRole] ?? DEFAULT_NAV;
  const isServiceAdvisor = user?.primaryRole === 'service_advisor';
  const isAdmin = user?.primaryRole === ROLES.ADMIN;

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
        {isServiceAdvisor
          ? navItems.map((item) => (
              <NavDropdownItem key={item.label} item={item} />
            ))
          : navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  'navbar__link' + (isActive ? ' navbar__link--active' : '')
                }
              >
                {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
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
