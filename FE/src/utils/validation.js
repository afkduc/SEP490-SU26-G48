/**
 * Validate field dùng chung FE (đồng bộ với BE fieldValidation).
 * Email chỉ chấp nhận đuôi: .com | .vn | .edu.vn
 */

export const EMAIL_HINT = 'Email chỉ chấp nhận đuôi .com, .vn hoặc .edu.vn';

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.(com|vn|edu\.vn)$/i;

const PHONE_REGEX = /^0[0-9]{9,10}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

/** Chỉ giữ chữ số, tối đa 11 (SĐT VN). */
export function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Hiển thị SĐT khi gõ: 0123456789 → 0123-456-789 (4-3-3; 11 số → 4-3-4).
 */
export function formatPhoneInput(value) {
  const d = phoneDigitsOnly(value);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}

export function isValidEmail(value) {
  if (value == null) return false;
  const email = String(value).trim();
  if (!email || email.length > 255) return false;
  return EMAIL_REGEX.test(email);
}

export function isValidPhone(value) {
  if (value == null) return false;
  return PHONE_REGEX.test(phoneDigitsOnly(value));
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
