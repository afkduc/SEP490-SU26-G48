/**
 * Hiển thị nhật ký hoạt động bằng tiếng Việt dễ hiểu (không cần biết code).
 */
import { getPermissionScreenLabel, getScreenLabel } from './screenLabels';
import { formatDateSafeWithOffset, secondsSince, getClockOffsetMs } from './dateUtils';

export const AUDIT_ACTION_LABELS = {
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
  BULK_TOGGLE: 'Cập nhật hàng loạt ma trận',
  SAVE_SCREEN_MATRIX: 'Lưu ma trận quyền màn hình',
  SAVE_USER_SCREEN_PERMISSIONS: 'Lưu quyền riêng người dùng',
  CLEAR_USER_SCREEN_PERMISSIONS: 'Xóa quyền riêng người dùng',
  APPROVE_PERMISSION_REQUEST: 'Duyệt yêu cầu cấp quyền',
  REJECT_PERMISSION_REQUEST: 'Từ chối yêu cầu cấp quyền',
  APPROVE_LOGIN_CHALLENGE: 'Đồng ý đăng nhập thiết bị khác',
  REJECT_LOGIN_CHALLENGE: 'Từ chối đăng nhập thiết bị khác',
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

export const AUDIT_FIELD_LABELS = {
  status: 'Trạng thái',
  branchId: 'Mã chi nhánh',
  branchName: 'Chi nhánh',
  roleId: 'Mã vai trò',
  roleName: 'Vai trò',
  role: 'Vai trò',
  phone: 'Số điện thoại',
  firstName: 'Họ',
  lastName: 'Tên',
  fullName: 'Họ và tên',
  email: 'Email',
  userName: 'Tên đăng nhập',
  specialtyId: 'Chuyên môn',
  name: 'Tên',
  permissionKey: 'Quyền (mã hệ thống)',
  screenKey: 'Màn hình',
  screenLabel: 'Tên màn hình',
  granted: 'Trạng thái quyền',
  itemCount: 'Số mục thay đổi',
  targetUserId: 'Người nhận (ID)',
  targetUserName: 'Người nhận',
  targetEmail: 'Email người nhận',
  newTokenVersion: 'Phiên bản phiên đăng nhập',
  reason: 'Lý do',
  pendingId: 'Mã yêu cầu đăng nhập',
  browser: 'Trình duyệt',
  os: 'Hệ điều hành',
  ip: 'Địa chỉ IP',
  device: 'Thiết bị',
  userId: 'Mã người dùng',
  actorId: 'Người thực hiện (ID)',
};

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

function getRoleLabel(roleName) {
  if (!roleName) return '—';
  const key = String(roleName).trim();
  return ROLE_LABELS[key] || ROLE_LABELS[key.toLowerCase()] || key;
}

export function getAuditActionLabel(action) {
  if (!action) return 'Thao tác';
  return AUDIT_ACTION_LABELS[action] || action;
}

/** Parse JSON an toàn */
export function parseAuditJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Đổi mô tả kỹ thuật (cả log cũ) sang tiếng Việt dễ đọc.
 */
export function humanizeAuditDescription(description, action, newValue) {
  const details = parseAuditJson(newValue) || {};
  const actionLabel = getAuditActionLabel(action);

  // Ưu tiên dựng lại từ details nếu có permission/screen/role
  const hasUsefulDetails =
    details.permissionKey ||
    details.screenKey ||
    details.roleName ||
    details.role ||
    details.targetUserId != null ||
    details.itemCount != null ||
    details.pendingId ||
    details.granted === true ||
    details.granted === false;

  if (hasUsefulDetails) {
    const screenLabel =
      getPermissionScreenLabel(details.permissionKey) !== '—'
        ? getPermissionScreenLabel(details.permissionKey)
        : getScreenLabel(details.screenKey);
    const roleLabel = getRoleLabel(details.roleName || details.role);
    const target =
      details.targetUserName ||
      details.targetEmail ||
      (details.targetUserId != null ? `người dùng #${details.targetUserId}` : null);
    const itemCount = details.itemCount != null ? Number(details.itemCount) : null;

    switch (action) {
      case 'APPROVE_PERMISSION_REQUEST':
        return [
          'Đã duyệt yêu cầu cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          target ? `cho ${target}` : null,
        ].filter(Boolean).join(' ');
      case 'REJECT_PERMISSION_REQUEST':
        return [
          'Đã từ chối yêu cầu cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          target ? `của ${target}` : null,
          details.reason ? `(lý do: ${details.reason})` : null,
        ].filter(Boolean).join(' ');
      case 'SAVE_SCREEN_MATRIX':
        return [
          'Đã lưu ma trận quyền màn hình',
          roleLabel !== '—' ? `cho vai trò ${roleLabel}` : null,
          itemCount != null ? `(${itemCount} mục)` : null,
        ].filter(Boolean).join(' ');
      case 'GRANT_SCREEN':
        return [
          'Đã cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          roleLabel !== '—' ? `cho vai trò ${roleLabel}` : null,
        ].filter(Boolean).join(' ');
      case 'REVOKE_SCREEN':
        return [
          'Đã thu hồi quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          roleLabel !== '—' ? `của vai trò ${roleLabel}` : null,
        ].filter(Boolean).join(' ');
      case 'APPROVE_LOGIN_CHALLENGE':
        return [
          'Đã đồng ý cho thiết bị khác đăng nhập',
          [details.browser, details.os].filter(Boolean).join(' · ') || details.device || null,
        ].filter(Boolean).join(' — ');
      case 'REJECT_LOGIN_CHALLENGE':
        return [
          'Đã từ chối đăng nhập từ thiết bị khác',
          [details.browser, details.os].filter(Boolean).join(' · ') || details.device || null,
        ].filter(Boolean).join(' — ');
      default:
        break;
    }
  }

  let text = String(description || '').trim();
  if (!text) return actionLabel;

  // Thay mã action đầu chuỗi
  Object.keys(AUDIT_ACTION_LABELS).forEach((code) => {
    const re = new RegExp(`^${code}\\s*:\\s*`, 'i');
    if (re.test(text)) {
      text = text.replace(re, `${AUDIT_ACTION_LABELS[code]}: `);
    }
  });

  // Thay permission / screen keys trong câu
  text = text.replace(/screen:[a-z0-9_.:-]+/gi, (m) => {
    const label = getPermissionScreenLabel(m);
    return label && label !== '—' ? `«${label}»` : m;
  });
  text = text.replace(/\bmàn\s+([a-z0-9_.:-]+)/gi, (_, key) => {
    const label = getScreenLabel(key);
    return label && label !== '—' ? `màn hình «${label}»` : `màn hình ${key}`;
  });
  text = text.replace(/\bquyền\s+(screen:[a-z0-9_.:-]+)/gi, (_, key) => {
    const label = getPermissionScreenLabel(key);
    return label && label !== '—' ? `quyền truy cập màn hình «${label}»` : `quyền ${key}`;
  });
  text = text.replace(/\bvai trò\s+([a-z0-9_]+)/gi, (_, role) => `vai trò ${getRoleLabel(role)}`);

  // Làm sạch tiền tố kỹ thuật còn sót
  text = text
    .replace(/\bpermissionKey\b/gi, 'mã quyền')
    .replace(/\bscreenKey\b/gi, 'màn hình')
    .replace(/\bitemCount\b/gi, 'số mục');

  return text || actionLabel;
}

/** Format 1 giá trị field cho DiffView */
export function formatAuditFieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return STATUS_LABELS[value] || String(value);
  if (key === 'granted') return value === true || value === 1 || value === 'true' ? 'Đã cấp' : 'Thu hồi / chưa cấp';
  if (key === 'permissionKey') {
    const label = getPermissionScreenLabel(value);
    return label && label !== '—' ? `${label} (${value})` : String(value);
  }
  if (key === 'screenKey') {
    const label = getScreenLabel(value);
    return label && label !== '—' ? `${label} (${value})` : String(value);
  }
  if (key === 'roleName' || key === 'role') return getRoleLabel(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

/**
 * Tóm tắt "giá trị mới" dạng danh sách dễ đọc (không dump JSON thô mặc định).
 * @returns {{ rows: Array<{label,value}>, summary: string } | null}
 */
export function summarizeAuditNewValue(newValue, action) {
  const obj = parseAuditJson(newValue);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  const preferredKeys = [
    'permissionKey',
    'screenKey',
    'roleName',
    'role',
    'targetUserName',
    'targetEmail',
    'targetUserId',
    'granted',
    'itemCount',
    'reason',
    'browser',
    'os',
    'ip',
    'device',
    'status',
    'email',
    'phone',
    'firstName',
    'lastName',
    'userName',
    'branchName',
    'name',
  ];

  const rows = [];
  const used = new Set();

  preferredKeys.forEach((key) => {
    if (obj[key] === undefined || obj[key] === null || obj[key] === '') return;
    used.add(key);
    rows.push({
      label: AUDIT_FIELD_LABELS[key] || key,
      value: formatAuditFieldValue(key, obj[key]),
    });
  });

  // Thêm vài field còn lại nếu object nhỏ
  Object.keys(obj).forEach((key) => {
    if (used.has(key)) return;
    if (typeof obj[key] === 'object') return; // bỏ matrix lớn
    if (rows.length >= 12) return;
    used.add(key);
    rows.push({
      label: AUDIT_FIELD_LABELS[key] || key,
      value: formatAuditFieldValue(key, obj[key]),
    });
  });

  if (!rows.length) return null;

  const summary = humanizeAuditDescription('', action, obj);
  return { rows, summary };
}

export function formatAuditTime(value) {
  if (value == null || value === '') return { main: '—', ago: '' };
  const main = formatDateSafeWithOffset(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    withSeconds: true,
  });
  const offset = getClockOffsetMs();
  const sec = secondsSince(value, Date.now() + offset);
  let ago = '';
  if (sec == null) ago = '';
  else if (sec < 0) ago = 'vừa xong';
  else if (sec < 5) ago = 'vừa xong';
  else if (sec < 60) ago = `${sec} giây trước`;
  else if (sec < 3600) ago = `${Math.floor(sec / 60)} phút trước`;
  else if (sec < 86400) ago = `${Math.floor(sec / 3600)} giờ trước`;
  else if (sec < 2592000) ago = `${Math.floor(sec / 86400)} ngày trước`;
  else ago = `${Math.floor(sec / 2592000)} tháng trước`;

  return { main, ago };
}
