import { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import './Navbar.css';

// ===== Admin =====
const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
  {
    label: 'User',
    icon: '👥',
    children: [
      { label: 'Danh sách User', path: '/admin/users' },
      { label: 'Thêm User', path: '/admin/users?create=true' },
    ],
  },
  {
    label: 'Role',
    icon: '🛡️',
    children: [
      { label: 'Danh sách Role', path: '/admin/roles' },
      { label: 'Phân quyền', path: '/admin/users' },
    ],
  },
  {
    label: 'Log',
    icon: '📜',
    children: [
      { label: 'Nhật ký hoạt động', path: '/admin/logs' },
      { label: 'Lịch sử đăng nhập', path: '/admin/logs/login' },
    ],
  },
];

// ===== Service Advisor =====
const SERVICE_ADVISOR_NAV = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
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

// ===== Manager =====
const MANAGER_NAV = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Kho', path: '/inventory' },
  {
    label: 'Nhân viên',
    children: [
      { label: 'Nhân viên', path: '/manager/employees' },
      { label: 'Thợ máy', path: '/manager/technicians' },
      { label: 'Tổ trưởng', path: '/manager/team-leaders' },
    ],
  },
  { label: 'Quyết toán sửa chữa', path: '/manager/settlements' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
  {
    label: 'Dịch vụ',
    children: [
      { label: 'Dịch vụ lẻ', path: '/manager/services' },
      { label: 'Gói dịch vụ', path: '/manager/service-packages' },
    ],
  },
];

// ===== Warehouse Staff (Nhan vien kho) - chi thay cac chuc nang lien quan den kho =====
const WAREHOUSE_STAFF_NAV = [
  { label: 'Tong quan kho', path: '/inventory', icon: '🏠', end: true },
  {
    label: 'Phu tung',
    icon: '📦',
    children: [
      { label: 'Danh sach phu tung', path: '/inventory/parts' },
    ],
  },
  { label: 'Ton kho', path: '/inventory/stock', icon: '🗃️' },
  {
    label: 'Phieu nhap',
    icon: '📥',
    children: [
      { label: 'Danh sach phieu nhap', path: '/inventory/import-requests' },
      { label: 'Tao phieu nhap', path: '/inventory/import-requests/new' },
    ],
  },
  { label: 'Nha cung cap', path: '/inventory/suppliers', icon: '🚚' },
];

// ===== Accountant (Ke toan) - chi xem kho, khong dropdown =====
const ACCOUNTANT_NAV = [
  { label: 'Tong quan kho', path: '/inventory', icon: '🏠' },
  { label: 'Phu tung', path: '/inventory/parts', icon: '📦' },
  { label: 'Ton kho', path: '/inventory/stock', icon: '🗃️' },
  { label: 'Phieu nhap', path: '/inventory/import-requests', icon: '📥' },
  { label: 'Nha cung cap', path: '/inventory/suppliers', icon: '🚚' },
];

// ===== General Director (Giam doc) - xem bao cao tong quan, co dropdown =====
const GENERAL_DIRECTOR_NAV = [
  { label: 'Tong quan kho', path: '/inventory', icon: '🏠', end: true },
  { label: 'Phu tung', path: '/inventory/parts', icon: '📦' },
  { label: 'Ton kho', path: '/inventory/stock', icon: '🗃️' },
  { label: 'Phieu nhap', path: '/inventory/import-requests', icon: '📥' },
  { label: 'Nha cung cap', path: '/inventory/suppliers', icon: '🚚' },
];

const NAV_ITEMS_BY_ROLE = {
  [ROLES.ADMIN]: ADMIN_NAV,
  general_director: GENERAL_DIRECTOR_NAV,
  manager: MANAGER_NAV,
  service_advisor: SERVICE_ADVISOR_NAV,
  warehouse_staff: WAREHOUSE_STAFF_NAV,
  accountant: ACCOUNTANT_NAV,
};

// Cac role co dropdown (vi cac role khac chi co 1-2 muc khong can dropdown).
const ROLES_WITH_DROPDOWN = new Set([
  ROLES.ADMIN,
  'service_advisor',
  'manager',
]);

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function NavDropdownItem({ item, currentPath }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  // So sanh exact match (bo qua query string o ca 2 phia) de tranh
  // truong hop /admin/logs/login van khop voi child /admin/logs.
  const isPathMatch = (configPath) => {
    const [baseConfig] = configPath.split('?');
    const [baseCurrent] = currentPath.split('?');
    return baseConfig === baseCurrent;
  };

  // Khi dropdown co children, parent duoc active neu bat ky child nao khop currentPath.
  const isParentActive = item.children
    ? item.children.some((c) => isPathMatch(c.path))
    : false;

  // Tu dong mo dropdown neu parent dang active de nguoi dung thay minh dang o day.
  const effectiveOpen = open || isParentActive;

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        end={item.end}
        className={({ isActive }) =>
          'navbar__link' + ((isActive || isPathMatch(item.path)) ? ' navbar__link--active' : '')
        }
      >
        {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
        {item.label}
      </NavLink>
    );
  }

  return (
    <div
      className={`navbar__dropdown-wrapper${isParentActive ? ' navbar__dropdown-wrapper--active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={
          'navbar__link navbar__link-btn' + (isParentActive ? ' navbar__link--active' : '')
        }
      >
        {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
        {item.label}
        <span className="navbar__link-caret">▼</span>
      </button>

      {effectiveOpen && (
        <div className="navbar__nav-dropdown">
          {item.children.map((child) => {
            const childActive = isPathMatch(child.path);
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={
                  'navbar__nav-dropdown-item' + (childActive ? ' navbar__nav-dropdown-item--active' : '')
                }
                onClick={() => setOpen(false)}
              >
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const role = user?.primaryRole;
  const navItems = NAV_ITEMS_BY_ROLE[role] ?? [];
  const supportsDropdown = ROLES_WITH_DROPDOWN.has(role);

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
        {navItems.map((item) =>
          supportsDropdown ? (
            <NavDropdownItem key={item.label} item={item} currentPath={location.pathname} />
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                'navbar__link' + (isActive ? ' navbar__link--active' : '')
              }
            >
              {item.icon && <span className="navbar__link-icon">{item.icon}</span>}
              {item.label}
            </NavLink>
          ),
        )}
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