/**
 * Nhãn tiếng Việt cho audit log (BE) — mô tả dễ hiểu cho người không biết code.
 */

const ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa / Vô hiệu hóa',
  DISABLE: 'Ngừng hoạt động',
  REACTIVATE: 'Kích hoạt lại',
  READ: 'Xem dữ liệu',
  LOGIN: 'Đăng nhập',
  FAILED_LOGIN: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  ASSIGN_ROLE: 'Gán vai trò',
  REMOVE_ROLE: 'Thu hồi vai trò',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
  GRANT_SCREEN: 'Cấp quyền màn hình',
  REVOKE_SCREEN: 'Thu hồi quyền màn hình',
  BULK_TOGGLE: 'Cập nhật hàng loạt ma trận quyền',
  SAVE_SCREEN_MATRIX: 'Lưu ma trận quyền màn hình',
  SAVE_USER_SCREEN_PERMISSIONS: 'Lưu quyền riêng của người dùng',
  CLEAR_USER_SCREEN_PERMISSIONS: 'Xóa quyền riêng của người dùng',
  APPROVE_PERMISSION_REQUEST: 'Duyệt yêu cầu cấp quyền',
  REJECT_PERMISSION_REQUEST: 'Từ chối yêu cầu cấp quyền',
  APPROVE_LOGIN_CHALLENGE: 'Đồng ý đăng nhập từ thiết bị khác',
  REJECT_LOGIN_CHALLENGE: 'Từ chối đăng nhập từ thiết bị khác',
  PERMISSION_MATRIX_BULK: 'Cập nhật ma trận phân quyền',
};

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  general_director: 'Giám đốc',
  director: 'Giám đốc',
  branch_manager: 'Quản lý chi nhánh',
  manager: 'Quản lý chi nhánh',
  service_advisor: 'Cố vấn dịch vụ',
  advisor: 'Cố vấn dịch vụ',
  team_leader: 'Tổ trưởng',
  leader: 'Tổ trưởng',
  technician: 'Kỹ thuật viên',
  warehouse_staff: 'Nhân viên kho',
  inventory: 'Nhân viên kho',
};

const SCREEN_LABELS = {
  dashboard: 'Tổng quan',
  users: 'Người dùng',
  branches: 'Chi nhánh',
  roles: 'Vai trò',
  permission_matrix: 'Ma trận quyền',
  role_screen_matrix: 'Ma trận màn hình theo vai trò',
  audit_logs: 'Nhật ký hoạt động',
  login_sessions: 'Lịch sử đăng nhập',
  devices: 'Thiết bị đăng nhập',
  specialties: 'Chuyên môn',
  profile: 'Hồ sơ cá nhân',
  notifications: 'Cài đặt thông báo',
  'repair-orders': 'Lệnh sửa chữa',
  'repair-settlement': 'Quyết toán sửa chữa',
  'customer-care': 'Chăm sóc khách hàng',
  customers: 'Khách hàng',
  'service-requests': 'Yêu cầu tư vấn',
  inventory: 'Kho phụ tùng',
  'director:dashboard': 'Giám đốc — Tổng quan',
  'director:reports': 'Giám đốc — Báo cáo doanh thu',
  'director:settlements': 'Giám đốc — Báo cáo quyết toán',
  'director:branches': 'Giám đốc — Chi nhánh',
  'director:employees': 'Giám đốc — Nhân viên',
  'director:branch_managers': 'Giám đốc — Quản lý chi nhánh',
  'director:technicians': 'Giám đốc — Thợ máy',
  'manager:dashboard': 'Quản lý chi nhánh — Tổng quan',
  'manager:employees': 'Quản lý chi nhánh — Nhân viên',
  'manager:technicians': 'Quản lý chi nhánh — Thợ máy',
  'manager:settlements': 'Quản lý chi nhánh — Quyết toán sửa chữa',
  'manager:services': 'Quản lý chi nhánh — Dịch vụ',
  'manager:service-packages': 'Quản lý chi nhánh — Gói dịch vụ',
  'manager:import_requests': 'Quản lý chi nhánh — Phiếu nhập kho',
  'manager:export_requests': 'Quản lý chi nhánh — Phiếu xuất kho',
  'manager:branch': 'Quản lý chi nhánh — Chi nhánh',
  'manager:inventory': 'Quản lý chi nhánh — Kho',
  'advisor:dashboard': 'Cố vấn dịch vụ — Tổng quan',
  'advisor:appointments': 'Cố vấn dịch vụ — Lịch hẹn',
  'advisor:customers': 'Cố vấn dịch vụ — Khách hàng',
  'advisor:orders': 'Cố vấn dịch vụ — Lệnh sửa chữa',
  'advisor:requests': 'Cố vấn dịch vụ — Yêu cầu',
  'advisor:vehicles': 'Cố vấn dịch vụ — Xe',
  'leader:dashboard': 'Tổ trưởng — Tổng quan',
  'leader:team': 'Tổ trưởng — Đội nhóm',
  'leader:orders': 'Tổ trưởng — Lệnh sửa chữa',
  'leader:tasks': 'Tổ trưởng — Công việc',
  'leader:technicians': 'Tổ trưởng — Thợ máy',
  'technician:dashboard': 'Kỹ thuật viên — Tổng quan',
  'technician:tasks': 'Kỹ thuật viên — Công việc',
  'inventory:products': 'Nhân viên kho — Phụ tùng',
  'inventory:stock': 'Nhân viên kho — Tồn kho',
  'inventory:suppliers': 'Nhân viên kho — Nhà cung cấp',
  'inventory:import-requests': 'Nhân viên kho — Phiếu nhập',
  'inventory:export-requests': 'Nhân viên kho — Phiếu xuất',
  'inventory:low-stock': 'Nhân viên kho — Sắp hết hàng',
  'warehouse:products': 'Nhân viên kho — Phụ tùng',
  'warehouse:stock': 'Nhân viên kho — Tồn kho',
};

const MODULE_LABELS = {
  director: 'Giám đốc',
  manager: 'Quản lý chi nhánh',
  advisor: 'Cố vấn dịch vụ',
  leader: 'Tổ trưởng',
  technician: 'Kỹ thuật viên',
  admin: 'Quản trị',
  inventory: 'Nhân viên kho',
  warehouse: 'Nhân viên kho',
};

const RESOURCE_LABELS = {
  dashboard: 'Tổng quan',
  reports: 'Báo cáo doanh thu',
  settlements: 'Quyết toán',
  branches: 'Chi nhánh',
  branch: 'Chi nhánh',
  employees: 'Nhân viên',
  branch_managers: 'Quản lý chi nhánh',
  technicians: 'Thợ máy',
  services: 'Dịch vụ',
  'service-packages': 'Gói dịch vụ',
  import_requests: 'Phiếu nhập',
  export_requests: 'Phiếu xuất',
  appointments: 'Lịch hẹn',
  team: 'Đội nhóm',
  orders: 'Lệnh sửa chữa',
  tasks: 'Công việc',
  requests: 'Yêu cầu',
  vehicles: 'Xe',
  users: 'Người dùng',
  roles: 'Vai trò',
  devices: 'Thiết bị',
  specialties: 'Chuyên môn',
  customers: 'Khách hàng',
  profile: 'Hồ sơ',
  notifications: 'Thông báo',
  inventory: 'Kho',
  products: 'Phụ tùng',
  stock: 'Tồn kho',
  suppliers: 'Nhà cung cấp',
  'low-stock': 'Sắp hết hàng',
  audit_logs: 'Nhật ký hoạt động',
  login_sessions: 'Lịch sử đăng nhập',
  permission_matrix: 'Ma trận quyền',
};

function humanizeToken(token = '') {
  return String(token)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getScreenLabel(screenKey) {
  if (!screenKey) return null;
  const key = String(screenKey).replace(/^screen:/, '').replace(/:access$/i, '');
  if (SCREEN_LABELS[key]) return SCREEN_LABELS[key];
  const parts = key.split(':').filter(Boolean);
  if (parts.length === 1) return RESOURCE_LABELS[parts[0]] || humanizeToken(parts[0]);
  const mod = MODULE_LABELS[parts[0]] || humanizeToken(parts[0]);
  const res = RESOURCE_LABELS[parts.slice(1).join(':')] || humanizeToken(parts.slice(1).join(':'));
  return `${mod} — ${res}`;
}

function getPermissionScreenLabel(permissionKey) {
  if (!permissionKey) return null;
  const raw = String(permissionKey);
  const m = raw.match(/^screen:(.+):access$/i);
  const screenKey = m ? m[1] : raw.replace(/^screen:/, '').replace(/:access$/i, '');
  return getScreenLabel(screenKey);
}

function getRoleLabel(roleName) {
  if (!roleName) return null;
  const key = String(roleName).trim();
  return ROLE_LABELS[key] || ROLE_LABELS[key.toLowerCase()] || key;
}

function getActionLabel(action) {
  if (!action) return 'Thao tác';
  return ACTION_LABELS[action] || String(action);
}

/**
 * Tạo mô tả tiếng Việt từ action + details object.
 */
function buildAuditDescription(action, details = {}) {
  const d = details && typeof details === 'object' ? details : {};
  const screenLabel =
    getPermissionScreenLabel(d.permissionKey) ||
    getScreenLabel(d.screenKey) ||
    null;
  const roleLabel = getRoleLabel(d.roleName || d.role);
  const targetUser =
    d.targetUserName ||
    d.targetEmail ||
    (d.targetUserId != null ? `người dùng #${d.targetUserId}` : null);
  const itemCount = d.itemCount != null ? Number(d.itemCount) : null;
  const device = [d.browser, d.os].filter(Boolean).join(' · ') || d.device || null;

  switch (action) {
    case 'APPROVE_PERMISSION_REQUEST':
      return [
        'Đã duyệt yêu cầu cấp quyền truy cập màn hình',
        screenLabel ? `«${screenLabel}»` : null,
        targetUser ? `cho ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    case 'REJECT_PERMISSION_REQUEST':
      return [
        'Đã từ chối yêu cầu cấp quyền truy cập màn hình',
        screenLabel ? `«${screenLabel}»` : null,
        targetUser ? `của ${targetUser}` : null,
        d.reason ? `(lý do: ${d.reason})` : null,
      ].filter(Boolean).join(' ');

    case 'GRANT_SCREEN':
      return [
        'Đã cấp quyền truy cập màn hình',
        screenLabel ? `«${screenLabel}»` : null,
        roleLabel ? `cho vai trò ${roleLabel}` : null,
        targetUser ? `cho ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    case 'REVOKE_SCREEN':
      return [
        'Đã thu hồi quyền truy cập màn hình',
        screenLabel ? `«${screenLabel}»` : null,
        roleLabel ? `của vai trò ${roleLabel}` : null,
        targetUser ? `của ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    case 'SAVE_SCREEN_MATRIX': {
      const parts = [
        'Đã lưu ma trận quyền màn hình',
        roleLabel ? `cho vai trò ${roleLabel}` : null,
        itemCount != null ? `(${itemCount} mục)` : null,
      ];
      const activeItems = d.activeItems != null ? Number(d.activeItems) : null;
      const l1Granted = d.l1Granted != null ? Number(d.l1Granted) : null;
      const l1Revoked = d.l1Revoked != null ? Number(d.l1Revoked) : null;
      if (activeItems != null) parts.push(`— ${activeItems} mục đang có quyền`);
      if (l1Granted > 0) parts.push(`— cấp thêm ${l1Granted} quyền truy cập`);
      if (l1Revoked > 0) parts.push(`— thu hồi ${l1Revoked} quyền truy cập`);
      return parts.filter(Boolean).join(' ');
    }

    case 'BULK_TOGGLE':
    case 'PERMISSION_MATRIX_BULK':
      return [
        'Đã cập nhật hàng loạt quyền màn hình',
        roleLabel ? `cho vai trò ${roleLabel}` : null,
        itemCount != null ? `(${itemCount} mục)` : null,
        d.granted === true ? '— cấp quyền' : null,
        d.granted === false ? '— thu hồi' : null,
      ].filter(Boolean).join(' ');

    case 'SAVE_USER_SCREEN_PERMISSIONS':
      return [
        'Đã lưu quyền riêng',
        targetUser ? `cho ${targetUser}` : null,
        screenLabel ? `màn hình «${screenLabel}»` : null,
        itemCount != null ? `(${itemCount} mục)` : null,
      ].filter(Boolean).join(' ');

    case 'CLEAR_USER_SCREEN_PERMISSIONS':
      return [
        'Đã xóa quyền riêng',
        targetUser ? `của ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    case 'APPROVE_LOGIN_CHALLENGE':
      return [
        'Đã đồng ý cho thiết bị khác đăng nhập vào tài khoản',
        device ? `(${device})` : null,
        d.ip ? `IP ${d.ip}` : null,
      ].filter(Boolean).join(' ');

    case 'REJECT_LOGIN_CHALLENGE':
      return [
        'Đã từ chối yêu cầu đăng nhập từ thiết bị khác',
        device ? `(${device})` : null,
        d.ip ? `IP ${d.ip}` : null,
      ].filter(Boolean).join(' ');

    case 'ASSIGN_ROLE':
      return [
        'Đã gán vai trò',
        roleLabel ? `«${roleLabel}»` : null,
        targetUser ? `cho ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    case 'REMOVE_ROLE':
      return [
        'Đã thu hồi vai trò',
        roleLabel ? `«${roleLabel}»` : null,
        targetUser ? `của ${targetUser}` : null,
      ].filter(Boolean).join(' ');

    default: {
      const bits = [];
      bits.push(getActionLabel(action));
      if (screenLabel) bits.push(`màn hình «${screenLabel}»`);
      if (roleLabel) bits.push(`vai trò ${roleLabel}`);
      if (targetUser) bits.push(targetUser);
      if (itemCount != null) bits.push(`${itemCount} mục`);
      if (d.granted === true) bits.push('(cấp quyền)');
      if (d.granted === false) bits.push('(thu hồi)');
      return bits.join(' — ');
    }
  }
}

module.exports = {
  ACTION_LABELS,
  ROLE_LABELS,
  SCREEN_LABELS,
  getScreenLabel,
  getPermissionScreenLabel,
  getRoleLabel,
  getActionLabel,
  buildAuditDescription,
};
