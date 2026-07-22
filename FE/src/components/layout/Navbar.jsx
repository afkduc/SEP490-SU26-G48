import { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useServiceRequests } from '../../contexts/ServiceRequestsContext';
import { ROLES } from '../../constants/roles';
import './Navbar.css';

// ===== Admin =====
const ADMIN_NAV = [
  { label: 'Bảng điều khiển', path: '/admin/dashboard' },
  {
    label: 'Người dùng',
    children: [
      { label: 'Danh sách người dùng', path: '/admin/users' },
      { label: 'Thêm người dùng', path: '/admin/users?create=true' },
    ],
  },
  {
    label: 'Vai trò',
    children: [
      { label: 'Phân quyền người dùng', path: '/admin/users' },
    ],
  },
  {
    label: 'Nhật ký',
    children: [
      { label: 'Nhật ký hoạt động', path: '/admin/logs' },
    ],
  },
];

// ===== Service Advisor =====
const SERVICE_ADVISOR_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard' },
  { label: 'Yêu cầu', path: '/service-requests' },
  {
    label: 'Quyết toán sửa chữa',
    children: [
      { label: 'Danh sách quyết toán', path: '/repair-settlement' },
      { label: 'Tạo quyết toán', path: '/repair-settlement/create' },
    ],
  },
  {
    label: 'Lệnh sửa chữa',
    children: [
      { label: 'Danh sách lệnh sửa chữa', path: '/repair-orders' },
      { label: 'Tạo lệnh sửa chữa', path: '/repair-orders/create' },
    ],
  },
  {
    label: 'Chăm sóc khách hàng',
    path: '/customer-care',
  },
  {
    label: 'Khách hàng',
    path: '/customers',
  },
];

// ===== Manager =====
const MANAGER_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard' },
  { label: 'Kho', path: '/inventory' },
  { label: 'Phiếu nhập', icon: '📥', path: '/manager/import-requests' },
  { label: 'Phiếu xuất', icon: '📤', path: '/manager/export-requests' },
  {
    label: 'Nhân viên',
    children: [
      { label: 'Nhân viên', path: '/manager/employees' },
      { label: 'Thợ máy', path: '/manager/technicians' },
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

// ===== Warehouse Staff (Nhân viên kho) - menu phẳng, không dropdown =====
const WAREHOUSE_STAFF_NAV = [
  { label: 'Tổng quan kho', path: '/inventory', end: true },
  { label: 'Phụ tùng', path: '/inventory/parts' },
  { label: 'Tồn kho', path: '/inventory/stock' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers' },
];

// ===== Accountant (Kế toán) - chỉ xem kho, không dropdown =====
const ACCOUNTANT_NAV = [
  { label: 'Tổng quan kho', path: '/inventory' },
  { label: 'Phụ tùng', path: '/inventory/parts' },
  { label: 'Tồn kho', path: '/inventory/stock' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers' },
];

// ===== General Director (Giám đốc) - xem báo cáo tổng quan, có dropdown =====
const GENERAL_DIRECTOR_NAV = [
  { label: 'Tổng quan kho', path: '/inventory', end: true },
  { label: 'Phụ tùng', path: '/inventory/parts' },
  { label: 'Tồn kho', path: '/inventory/stock' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers' },
];

// ===== Team Leader (Tổ trưởng kỹ thuật) - chỉ xem công việc được giao =====
const TEAM_LEADER_NAV = [
  { label: 'Công việc của tôi', path: '/repair-orders', end: true },
];

const NAV_ITEMS_BY_ROLE = {
  [ROLES.ADMIN]: ADMIN_NAV,
  general_director: GENERAL_DIRECTOR_NAV,
  manager: MANAGER_NAV,
  service_advisor: SERVICE_ADVISOR_NAV,
  warehouse_staff: WAREHOUSE_STAFF_NAV,
  accountant: ACCOUNTANT_NAV,
  team_leader: TEAM_LEADER_NAV,
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

function NavDropdownItem({ item, currentPath, badgeCount }) {
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
  // truong hop /admin/logs?tab=login khong bi match nham voi child /admin/logs.
  const isPathMatch = (configPath) => {
    const [baseConfig] = configPath.split('?');
    const [baseCurrent] = currentPath.split('?');
    return baseConfig === baseCurrent;
  };

  // Khi dropdown co children, parent duoc active neu bat ky child nao khop currentPath.
  // Chi dung de TO MAU nut cha - KHONG dung de ep mo dropdown, neu khong dropdown se
  // khong bao gio tu dong (rê chuột ra khỏi menu) sau khi da vao 1 trang con cua no.
  const isParentActive = item.children
    ? item.children.some((c) => isPathMatch(c.path))
    : false;

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        end={item.end}
        className={({ isActive }) =>
          'navbar__link' + ((isActive || isPathMatch(item.path)) ? ' navbar__link--active' : '')
        }
      >
        {item.label}
        {item.path === '/service-requests' && badgeCount > 0 && (
          <span className="navbar__badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
        )}
      </NavLink>
    );
  }

  return (
    <div
      className="navbar__dropdown-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={
          'navbar__link navbar__link-btn' + (isParentActive ? ' navbar__link--active' : '')
        }
      >
        {item.label}
        <span className="navbar__link-caret">▾</span>
      </button>

      {open && (
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
  const { pendingCount } = useServiceRequests();
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
        {supportsDropdown
          ? navItems.map((item) => (
              <NavDropdownItem
                key={item.label}
                item={item}
                currentPath={location.pathname}
                badgeCount={pendingCount}
              />
            ))
          : navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  'navbar__link' + (isActive ? ' navbar__link--active' : '')
                }
              >
                {item.label}
              </NavLink>
            ))}
      </nav>

      <div className="navbar__right">
        {/* Online indicator */}
        <div className="navbar__online-indicator" title="Tai khoan dang hoat dong">
          <span className="online-dot" />
          <span className="online-label">Trực tuyến</span>
        </div>
        {roleLabel && <span className="navbar__role-badge">{roleLabel}</span>}

        <div className="navbar__user" onClick={() => setDropdownOpen((v) => !v)}>
          <div className="navbar__avatar">{initials}</div>
          <span className="navbar__display-name">{displayName}</span>
          <span className="navbar__caret">▾</span>
        </div>

        {dropdownOpen && (
          <div className="navbar__dropdown">
            <div className="navbar__dropdown-header">
              <p className="navbar__dropdown-name">{user?.name}</p>
              <p className="navbar__dropdown-email">{user?.email}</p>
            </div>
            <hr />
            <button className="navbar__dropdown-item" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
