/**
 * Validate field dùng chung FE (đồng bộ với BE fieldValidation).
 * Email chỉ chấp nhận đuôi: .com | .vn | .edu.vn
 */

export const EMAIL_HINT = 'Email chỉ chấp nhận đuôi .com, .vn hoặc .edu.vn';

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.(com|vn|edu\.vn)$/i;

const PHONE_REGEX = /^0[0-9]{9,10}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

/** Gợi ý UI — độ dài tính theo chữ số, không tính dấu gạch. */
export const PHONE_HINT = 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)';

/** Chỉ giữ chữ số, tối đa 11 (SĐT VN). */
export function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Hiển thị SĐT khi gõ: 0123456789 → 0123-456-789 (4-3-3; 11 số → 4-3-4).
 * Độ dài input có gạch tối đa 13 ký tự (11 số + 2 dấu `-`).
 */
export function formatPhoneInput(value) {
  const d = phoneDigitsOnly(value);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}

/** maxLength cho input đã format (11 số + tối đa 2 dấu `-`). */
export const PHONE_INPUT_MAX_LENGTH = 13;

/** Hiển thị SĐT từ DB (chuẩn hóa dấu cũ 0236-3333-3333 → 0236-333-3333). */
export function formatPhoneDisplay(value) {
  const d = phoneDigitsOnly(value);
  if (!d) return '';
  return formatPhoneInput(d);
}

export function isValidEmail(value) {
  if (value == null) return false;
  const email = String(value).trim();
  if (!email || email.length > 255) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Hợp lệ khi (sau khi bỏ mọi ký tự không phải số):
 * bắt đầu bằng 0 và đúng 10 hoặc 11 chữ số.
 */
export function isValidPhone(value) {
  if (value == null) return false;
  return PHONE_REGEX.test(phoneDigitsOnly(value));
}

/** null nếu hợp lệ / đang trống tùy required; string = thông báo lỗi. */
export function getPhoneError(value, { required = true } = {}) {
  const digits = phoneDigitsOnly(value);
  if (!digits) return required ? 'Số điện thoại là bắt buộc' : null;
  if (!digits.startsWith('0')) return 'Số điện thoại phải bắt đầu bằng 0';
  if (digits.length < 10 || digits.length > 11) {
    return 'Số điện thoại phải gồm 10–11 chữ số (không tính dấu gạch)';
  }
  if (!isValidPhone(digits)) return PHONE_HINT;
  return null;
}

export function isValidUsername(value) {
  if (value == null) return false;
  return USERNAME_REGEX.test(String(value).trim());
}

export function isValidPassword(value, minLength = 6) {
  if (typeof value !== 'string') return false;
  const password = value.trim();
  if (password.length < minLength) return false;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
  return true;
}
