import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { usePermission } from '../../contexts/PermissionContext';
import { useServiceRequests } from '../../contexts/ServiceRequestsContext';
import { ROLES } from '../../constants/roles';
import './Navbar.css';

// ===== Admin =====
const ADMIN_NAV = [
  { label: 'Bảng điều khiển', path: '/admin/dashboard', permission: 'screen:dashboard:access' },
  {
    label: 'Người dùng',
    permission: 'screen:users:access',
    children: [
      { label: 'Danh sách người dùng', path: '/admin/users', permission: 'admin:users:read' },
      { label: 'Thêm người dùng', path: '/admin/users?create=true', permission: 'admin:users:create' },
    ],
  },
  {
    label: 'Vai trò',
    permission: 'screen:roles:access',
    children: [
      { label: 'Phân quyền người dùng', path: '/admin/users', permission: 'screen:users:access' },
    ],
  },
  {
    label: 'Nhật ký',
    permission: 'screen:audit_logs:access',
    children: [
      { label: 'Nhật ký hoạt động', path: '/admin/logs', permission: 'screen:audit_logs:access' },
    ],
  },
];

// ===== Service Advisor =====
const SERVICE_ADVISOR_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard', permission: 'screen:dashboard:access' },
  { label: 'Yêu cầu', path: '/service-requests', permission: 'service_requests:read' },
  {
    label: 'Quyết toán sửa chữa',
    permission: 'screen:repair-settlement:access',
    children: [
      { label: 'Danh sách quyết toán', path: '/repair-settlement', permission: 'repair_settlements:read' },
      { label: 'Tạo quyết toán', path: '/repair-settlement/create', permission: 'repair_settlements:create' },
    ],
  },
  {
    label: 'Chăm sóc khách hàng',
    path: '/customer-care',
    permission: 'screen:customer-care:access',
  },
  {
    label: 'Khách hàng',
    path: '/customers',
    permission: 'screen:customers:access',
  },
];

// ===== Manager =====
const MANAGER_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard', permission: 'screen:manager:dashboard:access' },
  { label: 'Kho', path: '/inventory', permission: 'screen:inventory:access' },
  { label: 'Phiếu nhập', icon: '📥', path: '/manager/import-requests', permission: 'screen:manager:import_requests:access' },
  { label: 'Phiếu xuất', icon: '📤', path: '/manager/export-requests', permission: 'screen:manager:export_requests:access' },
  {
    label: 'Nhân viên',
    permission: 'screen:manager:employees:access',
    children: [
      { label: 'Nhân viên', path: '/manager/employees', permission: 'screen:manager:employees:access' },
      { label: 'Thợ máy', path: '/manager/technicians', permission: 'screen:manager:technicians:access' },
    ],
  },
  { label: 'Quyết toán sửa chữa', path: '/manager/settlements', permission: 'screen:manager:settlements:access' },
  { label: 'Chăm sóc khách hàng', path: '/customer-care', permission: 'screen:customer-care:access' },
  { label: 'Khách hàng', path: '/customers', permission: 'screen:customers:access' },
  {
    label: 'Dịch vụ',
    permission: 'screen:manager:services:access',
    children: [
      { label: 'Dịch vụ lẻ', path: '/manager/services', permission: 'screen:manager:services:access' },
      { label: 'Gói dịch vụ', path: '/manager/service-packages', permission: 'screen:manager:services:access' },
    ],
  },
];

// ===== Warehouse Staff (Nhân viên kho) - menu phẳng, không dropdown =====
const WAREHOUSE_STAFF_NAV = [
  { label: 'Tổng quan kho', path: '/inventory', end: true, permission: 'screen:inventory:access' },
  { label: 'Phụ tùng', path: '/inventory/parts', permission: 'inventory:products:read' },
  { label: 'Tồn kho', path: '/inventory/stock', permission: 'screen:inventory:access' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests', permission: 'import_requests:read' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests', permission: 'export_requests:read' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers', permission: 'inventory:suppliers:read' },
];

// ===== General Director (Giám đốc) - xem báo cáo tổng quan, có dropdown =====
const GENERAL_DIRECTOR_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard', permission: 'screen:director:dashboard:access' },
  { label: 'Báo cáo doanh thu', path: '/general-director/reports', permission: 'screen:director:reports:access' },
  { label: 'Báo cáo quyết toán', path: '/general-director/settlements', permission: 'screen:director:settlements:access' },
  { label: 'Chi nhánh', path: '/general-director/branches', permission: 'screen:director:branches:access' },
  { label: 'Nhân viên', path: '/general-director/employees', permission: 'screen:director:employees:access' },
  { label: 'Quản lý chi nhánh', path: '/general-director/branch-managers', permission: 'screen:director:branch_managers:access' },
  { label: 'Thợ máy', path: '/general-director/technicians', permission: 'screen:director:technicians:access' },
];

// ===== Team Leader (Tổ trưởng kỹ thuật) - chỉ xem công việc được giao =====
const TEAM_LEADER_NAV = [
  { label: 'Bảng điều khiển', path: '/dashboard', permission: 'screen:dashboard:access' },
  { label: 'Công việc của tôi', path: '/repair-orders', end: true, permission: 'screen:repair-orders:access' },
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
  const { can } = usePermission();
  const { pendingCount } = useServiceRequests();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Menu chinh tren man hep (tablet/dien thoai) - an mac dinh, mo qua nut
  // hamburger, dong lai ngay khi bam vao 1 muc de khong che het man hinh.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = user?.primaryRole;
  const rawNavItems = NAV_ITEMS_BY_ROLE[role] ?? [];
  const supportsDropdown = ROLES_WITH_DROPDOWN.has(role);

  // Filter items theo permission. Voi item co children, chi hien thi neu it nhat
  // 1 child duoc phep. Parent permission la optional de tranh an dropdown cha
  // khi user van co the vao 1 trong cac child.
  const navItems = rawNavItems
    .map((item) => {
      if (!item.children) {
        return item.permission && !can(item.permission) ? null : item;
      }
      const allowedChildren = item.children.filter(
        (c) => !c.permission || can(c.permission)
      );
      if (allowedChildren.length === 0) return null;
      // Neu parent co permission rieng ma user khong co, van cho phep neu co child duoc phep
      // (uu tien child). Nguoc lai, neu parent co permission va user co thi show.
      if (item.permission && can(item.permission)) {
        return { ...item, children: allowedChildren };
      }
      if (item.permission && !can(item.permission)) {
        // Parent khong co quyen nhung co 1 child duoc phep -> chi show cac child do
        return { ...item, label: null, children: allowedChildren, _hideParent: true };
      }
      return { ...item, children: allowedChildren };
    })
    .filter(Boolean)
    .filter((item) => !item._hideParent || (item.children && item.children.length > 0));

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
                navigate(role === 'admin' ? '/admin/profile' : '/profile');
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
