/**
 * Chuẩn hóa format field dùng chung Presentation + Application.
 * Email chỉ chấp nhận đuôi: .com | .vn | .edu.vn
 * (vd: a@gmail.com, a@autogara.vn, a@fpt.edu.vn — từ chối a@mail.v)
 */

const EMAIL_MAX_LENGTH = 255;
const NAME_MAX_LENGTH = 100;
const USERNAME_MIN = 3;
const USERNAME_MAX = 50;
const PASSWORD_MIN_LENGTH = 6;
const BRANCH_CODE_MAX = 20;
const SPECIALTY_CODE_MAX = 30;
const SPECIALTY_NAME_MAX = 100;

/** Local@domain.(com|vn|edu.vn) — không cho TLD 1 ký tự kiểu .v */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.(com|vn|edu\.vn)$/i;

const PHONE_REGEX = /^0[0-9]{9,10}$/;
/**
 * Bien so VN: 2 so tinh + 1-2 chu (co the kem 1 so) + 4-5 so serial.
 * Dau "-" bat buoc (phan tach vung/serial), dau "." KHONG con trong regex vi
 * chi la cach trinh bay cho de doc ("30A-123.45" == "30A-12345" ngoai doi) -
 * normalizeBienSo() da loai no truoc khi test/luu/so sanh, xem ham do.
 */
const BIEN_SO_REGEX = /^\d{2}[A-Z]{1,2}\d?-\d{4,5}$/;
/**
 * So khung (VIN) chuan quoc te ISO 3779: DUNG 17 ky tu chu+so. Chi ap dung
 * cho SO KHUNG (frame_number) - so may (engine_number) KHONG theo chuan nay,
 * do dai tuy hang xe nen validate rieng, long hon (xem customerValidation.js).
 */
const FRAME_NUMBER_REGEX = /^[A-Z0-9]{17}$/;
/** 3–50 ký tự; chỉ chữ/số/._-; bắt buộc có ít nhất 1 chữ cái (không cho toàn số). */
const USERNAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9._-]{3,50}$/;
/** Họ/Tên: chữ cái Unicode (có dấu), khoảng trắng / dấu nháy / gạch giữa các từ. */
const PERSON_NAME_REGEX = /^\p{L}+(?:[ '\-]\p{L}+)*$/u;
const PASSWORD_HAS_LETTER = /[A-Za-z]/;
const PASSWORD_HAS_DIGIT = /[0-9]/;

const EMAIL_HINT = 'Email chỉ chấp nhận đuôi .com, .vn hoặc .edu.vn';
const USERNAME_HINT = `Tên đăng nhập ${USERNAME_MIN}–${USERNAME_MAX} ký tự, gồm chữ cái; được dùng thêm số, ., _, -`;
const PERSON_NAME_HINT = 'Chỉ gồm chữ cái (có dấu), khoảng trắng hoặc dấu gạch';

function isValidEmail(value) {
  if (value === undefined || value === null) return false;
  const email = String(value).trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(email);
}

function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

/** Bắt đầu bằng 0, 10–11 chữ số (bỏ qua dấu gạch / ký tự khác). */
function isValidPhone(value) {
  if (value === undefined || value === null) return false;
  return PHONE_REGEX.test(phoneDigitsOnly(value));
}

/**
 * Chuan hoa bien so de VALIDATE, LUU va SO SANH deu dung CHUNG 1 gia tri:
 * xoa khoang trang, viet hoa, va xoa dau "." (thuan tuy trinh bay, khong
 * phai ky tu phan biet 2 bien so khac nhau). Phai goi ham nay o MOI noi
 * tao/tim xe theo bien so - neu chi doi regex ma quen doi noi INSERT/SELECT
 * thi "30A-123.45" va "30A-12345" van tao ra 2 xe khac nhau trong DB.
 */
function normalizeBienSo(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
}

function isValidUsername(value) {
  if (value === undefined || value === null) return false;
  return USERNAME_REGEX.test(String(value).trim());
}

/** null nếu hợp lệ / trống tùy required; string = thông báo lỗi. */
function getUsernameError(value, { required = true } = {}) {
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

function isValidPersonName(value) {
  if (value === undefined || value === null) return false;
  const name = String(value).trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX_LENGTH) return false;
  return PERSON_NAME_REGEX.test(name);
}

/**
 * @param {string} label Ví dụ: 'Họ' | 'Tên'
 * @returns {string|null}
 */
function getPersonNameError(value, { required = false, label = 'Tên' } = {}) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return required ? `${label} là bắt buộc` : null;
  if (name.length > NAME_MAX_LENGTH) return `${label} tối đa ${NAME_MAX_LENGTH} ký tự`;
  if (!PERSON_NAME_REGEX.test(name)) {
    return `${label} ${PERSON_NAME_HINT.toLowerCase()}`;
  }
  return null;
}

/**
 * Tên chi nhánh: bắt buộc, tối đa NAME_MAX_LENGTH, không được bắt đầu bằng số,
 * phải có ít nhất một chữ cái.
 */
function getBranchNameError(value, { required = true } = {}) {
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

function isValidBranchName(value) {
  return getBranchNameError(value, { required: true }) === null;
}

function isValidPassword(value) {
  if (typeof value !== 'string') return false;
  const password = value.trim();
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  if (!PASSWORD_HAS_LETTER.test(password) || !PASSWORD_HAS_DIGIT.test(password)) return false;
  return true;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

module.exports = {
  EMAIL_REGEX,
  PHONE_REGEX,
  BIEN_SO_REGEX,
  FRAME_NUMBER_REGEX,
  USERNAME_REGEX,
  PERSON_NAME_REGEX,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN_LENGTH,
  BRANCH_CODE_MAX,
  SPECIALTY_CODE_MAX,
  SPECIALTY_NAME_MAX,
  EMAIL_HINT,
  USERNAME_HINT,
  PERSON_NAME_HINT,
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly,
  normalizeBienSo,
  isValidUsername,
  getUsernameError,
  isValidPersonName,
  getPersonNameError,
  isValidBranchName,
  getBranchNameError,
  isValidPassword,
  parsePositiveInt,
};
