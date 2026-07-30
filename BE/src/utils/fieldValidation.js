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
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;
const PASSWORD_HAS_LETTER = /[A-Za-z]/;
const PASSWORD_HAS_DIGIT = /[0-9]/;

const EMAIL_HINT = 'Email chỉ chấp nhận đuôi .com, .vn hoặc .edu.vn';

function isValidEmail(value) {
  if (value === undefined || value === null) return false;
  const email = String(value).trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(email);
}

function isValidPhone(value) {
  if (value === undefined || value === null) return false;
  return PHONE_REGEX.test(String(value).trim());
}

function isValidUsername(value) {
  if (value === undefined || value === null) return false;
  return USERNAME_REGEX.test(String(value).trim());
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
  USERNAME_REGEX,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN_LENGTH,
  BRANCH_CODE_MAX,
  SPECIALTY_CODE_MAX,
  SPECIALTY_NAME_MAX,
  EMAIL_HINT,
  isValidEmail,
  isValidPhone,
  isValidUsername,
  isValidPassword,
  parsePositiveInt,
};
