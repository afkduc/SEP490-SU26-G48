/**
 * Validate field dùng chung FE (đồng bộ với BE fieldValidation).
 * Email chỉ chấp nhận đuôi: .com | .vn | .edu.vn
 */

export const EMAIL_HINT = 'Email chỉ chấp nhận đuôi .com, .vn hoặc .edu.vn';
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50;
export const NAME_MAX_LENGTH = 100;
export const USERNAME_HINT =
  `Tên đăng nhập ${USERNAME_MIN}–${USERNAME_MAX} ký tự, gồm chữ cái; được dùng thêm số, ., _, -`;
export const PERSON_NAME_HINT = 'Chỉ gồm chữ cái (có dấu), khoảng trắng hoặc dấu gạch';

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.(com|vn|edu\.vn)$/i;

const PHONE_REGEX = /^0[0-9]{9,10}$/;
/** 3–50 ký tự; chỉ chữ/số/._-; bắt buộc có ít nhất 1 chữ cái. */
const USERNAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9._-]{3,50}$/;
/** Họ/Tên: chữ cái Unicode (có dấu), khoảng trắng / dấu nháy / gạch giữa các từ. */
const PERSON_NAME_REGEX = /^\p{L}+(?:[ '\-]\p{L}+)*$/u;

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

/** null nếu hợp lệ / trống tùy required; string = thông báo lỗi. */
export function getUsernameError(value, { required = true } = {}) {
  const username = String(value || '').trim();
  if (!username) return required ? 'Tên đăng nhập là bắt buộc' : null;
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Tên đăng nhập phải từ ${USERNAME_MIN}–${USERNAME_MAX} ký tự`;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return 'Tên đăng nhập chỉ gồm chữ, số, ., _, -';
  }
  if (!/[A-Za-z]/.test(username)) {
    return 'Tên đăng nhập phải có ít nhất một chữ cái';
  }
  if (!isValidUsername(username)) return USERNAME_HINT;
  return null;
}

export function isValidPersonName(value) {
  if (value == null) return false;
  const name = String(value).trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX_LENGTH) return false;
  return PERSON_NAME_REGEX.test(name);
}

/** null nếu hợp lệ / trống tùy required; string = thông báo lỗi. */
export function getPersonNameError(value, { required = false, label = 'Tên' } = {}) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return required ? `${label} là bắt buộc` : null;
  if (name.length > NAME_MAX_LENGTH) return `${label} tối đa ${NAME_MAX_LENGTH} ký tự`;
  if (!PERSON_NAME_REGEX.test(name)) {
    return `${label} chỉ gồm chữ cái (có dấu), khoảng trắng hoặc dấu gạch`;
  }
  return null;
}

/**
 * Tên chi nhánh: bắt buộc, tối đa NAME_MAX_LENGTH, không bắt đầu bằng số,
 * phải có ít nhất một chữ cái.
 */
export function getBranchNameError(value, { required = true } = {}) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return required ? 'Tên chi nhánh là bắt buộc' : null;
  if (name.length > NAME_MAX_LENGTH) {
    return `Tên chi nhánh tối đa ${NAME_MAX_LENGTH} ký tự`;
  }
  if (/^\p{N}/u.test(name)) {
    return 'Tên chi nhánh không được bắt đầu bằng số';
  }
  if (!/\p{L}/u.test(name)) {
    return 'Tên chi nhánh phải có chữ cái';
  }
  return null;
}

export function isValidBranchName(value) {
  return getBranchNameError(value, { required: true }) === null;
}

export function isValidPassword(value, minLength = 6) {
  if (typeof value !== 'string') return false;
  const password = value.trim();
  if (password.length < minLength) return false;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
  return true;
}
