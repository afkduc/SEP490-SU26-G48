import { formatDateSafe } from '../../../utils/dateUtils';

export const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
  { value: 'LOGOUT', label: 'Đăng xuất' },
  { value: 'FORCE_LOGOUT', label: 'Buộc đăng xuất' },
];

export const ACTION_CLASS = {
  LOGIN: 'badge--success',
  LOGIN_FAILED: 'badge--danger',
  LOGOUT: 'badge--secondary',
  FORCE_LOGOUT: 'badge--orange',
};
export const ACTION_LABEL = {
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
};

export const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'ended', label: 'Đã đăng xuất' },
  { value: 'failed', label: 'Thất bại' },
];

export const STATUS_CLASS = {
  active: 'badge--success',
  ended: 'badge--secondary',
  failed: 'badge--danger',
};
export const STATUS_LABEL = { active: 'Đang hoạt động', ended: 'Đã đăng xuất', failed: 'Thất bại' };

export function formatDate(value) {
  // Su dung formatDateSafe de parse an toan va hien thi VN timezone
  // (khop voi server tra ve UTC). Cu: khong co timeZone nen dung browser local.
  return formatDateSafe(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    withSeconds: true,
  });
}

export function formatDuration(seconds) {
  if (seconds === undefined || seconds === null) return null;
  if (seconds < 0) return null;
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} giờ`);
  if (remM > 0) parts.push(`${remM} phút`);
  if (s > 0 && h === 0) parts.push(`${s} giây`);
  return parts.join(' ') || '0 phút';
}

export function liveDurationSeconds(loginTime) {
  if (!loginTime) return null;
  const t = new Date(loginTime).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}
