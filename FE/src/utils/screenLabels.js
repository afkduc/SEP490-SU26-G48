/**
 * Nhãn tiếng Việt cho screen_key trong ma trận / yêu cầu cấp quyền.
 * Ưu tiên map FE (UTF-8) — bỏ qua label API bị vỡ encoding (chứa ?).
 */

const SCREEN_LABELS = {
  // Admin / hệ thống
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

  // Nghiệp vụ chung
  'repair-orders': 'Lệnh sửa chữa',
  'repair-settlement': 'Quyết toán sửa chữa',
  'customer-care': 'Chăm sóc khách hàng',
  customers: 'Khách hàng',
  'service-requests': 'Yêu cầu tư vấn',
  inventory: 'Kho phụ tùng',

  // Giám đốc
  'director:dashboard': 'Giám đốc — Tổng quan',
  'director:reports': 'Giám đốc — Báo cáo doanh thu',
  'director:settlements': 'Giám đốc — Báo cáo quyết toán',
  'director:branches': 'Giám đốc — Chi nhánh',
  'director:employees': 'Giám đốc — Nhân viên',
  'director:branch_managers': 'Giám đốc — Quản lý chi nhánh',
  'director:technicians': 'Giám đốc — Thợ máy',

  // Quản lý chi nhánh
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

  // Cố vấn / tổ / thợ
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

  // Kho
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
  audit: 'Nhật ký',
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
  'import-requests': 'Phiếu nhập',
  export_requests: 'Phiếu xuất',
  'export-requests': 'Phiếu xuất',
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
  'repair-orders': 'Lệnh sửa chữa',
  'repair-settlement': 'Quyết toán sửa chữa',
  'customer-care': 'Chăm sóc khách hàng',
  'service-requests': 'Yêu cầu tư vấn',
  permission_matrix: 'Ma trận quyền',
  audit_logs: 'Nhật ký',
  login_sessions: 'Lịch sử đăng nhập',
};

function humanizeToken(token = '') {
  return String(token)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Label API bị encoding hỏng thường chứa ? thay cho dấu tiếng Việt */
function isCorruptedLabel(label) {
  if (!label) return true;
  const s = String(label);
  if (!s.trim()) return true;
  if (s.includes('?') || s.includes('\uFFFD')) return true;
  return false;
}

/**
 * @param {string} screenKey - vd director:branch_managers
 * @param {string|null} apiLabel - screenLabel từ API (nếu có)
 */
export function getScreenLabel(screenKey, apiLabel = null) {
  if (!screenKey) return '—';

  const key = String(screenKey).replace(/^screen:/, '').replace(/:access$/, '');

  // Ưu tiên map FE (UTF-8 ổn định)
  if (SCREEN_LABELS[key]) return SCREEN_LABELS[key];

  // API label chỉ dùng khi không bị vỡ chữ và không có trong map
  if (apiLabel && !isCorruptedLabel(apiLabel)) {
    return String(apiLabel).trim();
  }

  const parts = key.split(':').filter(Boolean);
  if (parts.length === 1) {
    return RESOURCE_LABELS[parts[0]] || humanizeToken(parts[0]);
  }

  const module = parts[0];
  const resource = parts.slice(1).join(':');
  const modLabel = MODULE_LABELS[module] || humanizeToken(module);
  const resLabel = RESOURCE_LABELS[resource] || humanizeToken(resource);
  return `${modLabel} — ${resLabel}`;
}

/**
 * Từ permission key đầy đủ (screen:director:branch_managers:access)
 */
export function getPermissionScreenLabel(permissionKey, apiLabel = null) {
  if (!permissionKey) return '—';
  const raw = String(permissionKey);
  const m = raw.match(/^screen:(.+):access$/i);
  const screenKey = m ? m[1] : raw.replace(/^screen:/, '').replace(/:access$/, '');
  return getScreenLabel(screenKey, apiLabel);
}

export { SCREEN_LABELS };
