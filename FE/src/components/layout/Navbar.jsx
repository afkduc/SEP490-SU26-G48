import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getRoleProfilePath } from '../../contexts/AppContext';
import { useServiceRequests } from '../../contexts/ServiceRequestsContext';
import { ROLES } from '../../constants/roles';
import ScrollToggleButton from '../common/ScrollToggleButton';
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
  { label: 'Chăm sóc khách hàng', path: '/customer-care' },
  { label: 'Khách hàng', path: '/customers' },
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

// ===== Warehouse Staff (Nhân viên kho) =====
const WAREHOUSE_STAFF_NAV = [
  { label: 'Tổng quan kho', path: '/inventory', end: true },
  { label: 'Phụ tùng', path: '/inventory/parts' },
  { label: 'Tồn kho', path: '/inventory/stock' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers' },
];

// ===== General Director =====
const GENERAL_DIRECTOR_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard' },
  { label: 'Báo cáo doanh thu', path: '/general-director/reports/revenue' },
  { label: 'Báo cáo quyết toán', path: '/general-director/reports/settlements' },
  { label: 'Chi nhánh', path: '/general-director/branch-managers' },
  { label: 'Nhân viên', path: '/general-director/employees' },
  { label: 'Quản lý chi nhánh', path: '/general-director/branch-managers' },
  { label: 'Thợ máy', path: '/general-director/technicians' },
];

// ===== Team Leader =====
const TEAM_LEADER_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard' },
  { label: 'Công việc của tôi', path: '/repair-orders', end: true },
];

const NAV_ITEMS_BY_ROLE = {
  [ROLES.ADMIN]: ADMIN_NAV,
  [ROLES.GENERAL_DIRECTOR]: GENERAL_DIRECTOR_NAV,
  [ROLES.MANAGER]: MANAGER_NAV,
  [ROLES.SERVICE_ADVISOR]: SERVICE_ADVISOR_NAV,
  [ROLES.WAREHOUSE_STAFF]: WAREHOUSE_STAFF_NAV,
  [ROLES.TEAM_LEADER]: TEAM_LEADER_NAV,
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

// Phai trung voi breakpoint @media (max-width: 1024px) trong Navbar.css noi
// menu chinh gap thanh hamburger. Duoi nguong nay, dropdown con dieu khien
// bang CLICK (accordion) vi khong co su kien hover tren thiet bi cham; tu
// nguong nay tro len, giu nguyen hanh vi hover nhu cu. Neu ca 2 cung bat
// (vd may co man hinh cam ung + chuot/trackpad) se bi xung dot: hover mo ra
// truoc, roi click lai dong ngay lai - nen chi bat 1 trong 2 tuy kich thuoc man hinh.
const NAV_DROPDOWN_COMPACT_QUERY = '(max-width: 1024px)';

function NavDropdownItem({ item, currentPath, badgeCount, onNavigate }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NAV_DROPDOWN_COMPACT_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(NAV_DROPDOWN_COMPACT_QUERY);
    const handleChange = (e) => setIsCompact(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const handleMouseEnter = () => {
    if (isCompact) return;
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (isCompact) return;
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
        onClick={onNavigate}
      >
        {item.label}
        {item.path === '/service-requests' && badgeCount > 0 && (
          <span className="navbar__badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
        )}
      </NavLink>
    );
  }

  // Truong hop parent bi an (label === null) nhung co children -> render chi children
  if (!item.label) {
    return (
      <div className="navbar__inline-children">
        {item.children.map((child) => (
          <NavLink
            key={child.path}
            to={child.path}
            className={({ isActive }) =>
              'navbar__link' + ((isActive || isPathMatch(child.path)) ? ' navbar__link--active' : '')
            }
          >
            {child.label}
          </NavLink>
        ))}
      </div>
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
        // Click de mo/dong - CHI ap dung o che do compact (man hep), vi hover
        // van hoat dong binh thuong tren desktop nen khong can click o do
        // (tranh xung dot: hover mo ra truoc, click lai dong ngay lai).
        onClick={() => { if (isCompact) setOpen((v) => !v); }}
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
                onClick={() => { setOpen(false); onNavigate?.(); }}
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
  // Menu chinh tren man hep (tablet/dien thoai) - an mac dinh, mo qua nut
  // hamburger, dong lai ngay khi bam vao 1 muc de khong che het man hinh.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = user?.primaryRole;
  // Sau khi gỡ ma trận quyền: menu theo role, không filter theo permission key.
  const navItems = NAV_ITEMS_BY_ROLE[role] ?? [];
  const supportsDropdown = ROLES_WITH_DROPDOWN.has(role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  const initials = getInitials(user?.name || '');
  const roleLabel = user?.primaryRoleLabel || user?.primaryRole || '';
  const displayName = user?.lastName || user?.name?.split(' ').pop() || '';

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <img className="navbar__logo" src="/AutoGaraLogo-Photoroom.png" alt="AutoGara" />
      </div>

      <button
        type="button"
        className={'navbar__hamburger' + (mobileNavOpen ? ' navbar__hamburger--active' : '')}
        aria-label={mobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>

      <nav className={'navbar__nav' + (mobileNavOpen ? ' navbar__nav--open' : '')}>
        {supportsDropdown
          ? navItems.map((item) => (
              <NavDropdownItem
                key={item.label || item.path}
                item={item}
                currentPath={location.pathname}
                badgeCount={pendingCount}
                onNavigate={closeMobileNav}
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
                onClick={closeMobileNav}
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
            <button
              className="navbar__dropdown-item"
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                navigate(getRoleProfilePath(user));
              }}
            >
              Hồ sơ cá nhân
            </button>
            <button className="navbar__dropdown-item navbar__dropdown-item--danger" type="button" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
