const { isValidEmail, isValidPhone, PERSON_NAME_REGEX, EMAIL_HINT, BIEN_SO_REGEX, normalizeBienSo, FRAME_NUMBER_REGEX } = require('../../utils/fieldValidation');

// Rang buoc du lieu KHACH HANG dung chung cho moi duong vao (sua qua form,
// import Excel) - truoc day moi noi tu kiem 1 kieu (sua chi bat "ten/SDT
// khong trong", Excel chi bat SDT) nen lot du lieu rac: ten "â", CCCD "12",
// sinh nam 1852, email "te. st". Do dai toi da khop dung cot trong DB de
// bao loi de hieu thay vi SQL Server nem "String or binary data would be
// truncated".

const NAME_MIN = 2;
const NAME_MAX = 150;           // customers.full_name nvarchar(150)
const CONTACT_NAME_MAX = 100;   // customers.contact_name nvarchar(100)
const EMAIL_MAX = 100;          // customers.email varchar(100)
const ADDRESS_MAX = 255;        // customers.address nvarchar(255)
const MAX_AGE_YEARS = 120;
const MIN_AGE_YEARS = 0;

// CCCD 12 so (mau moi) hoac CMND 9 so (mau cu).
const CCCD_REGEX = /^[0-9]{9}([0-9]{3})?$/;
// Ma so thue VN: 10 so, hoac 10 so + "-" + 3 so (chi nhanh).
const TAX_CODE_REGEX = /^\d{10}(-\d{3})?$/;

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

function parseDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = khong doc duoc
}

/**
 * Tra ve mang thong bao loi (rong = hop le). Khong nem loi de noi goi tu
 * quyet dinh: form sua gop lai nem 400, import Excel gan vao tung dong.
 * @param {Object} data - { fullName, phone, cccd, dateOfBirth, email, address, taxCode, contactName, contactPhone }
 */
function getCustomerFieldErrors(data = {}) {
  const errors = [];

  const fullName = clean(data.fullName);
  if (!fullName) errors.push('Họ và tên không được để trống');
  else if (fullName.length < NAME_MIN) errors.push(`Họ và tên phải có ít nhất ${NAME_MIN} ký tự`);
  else if (fullName.length > NAME_MAX) errors.push(`Họ và tên tối đa ${NAME_MAX} ký tự`);
  else if (!PERSON_NAME_REGEX.test(fullName)) errors.push('Họ và tên chỉ gồm chữ cái (có dấu), khoảng trắng hoặc dấu gạch');

  const phone = clean(data.phone);
  if (!phone) errors.push('Số điện thoại không được để trống');
  else if (!isValidPhone(phone)) errors.push('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10–11 chữ số)');

  const cccd = clean(data.cccd);
  if (cccd && !CCCD_REGEX.test(cccd)) errors.push('CCCD phải gồm 12 chữ số (hoặc CMND cũ 9 chữ số)');

  const dob = parseDate(data.dateOfBirth);
  if (dob === undefined) {
    errors.push('Ngày sinh không đúng định dạng');
  } else if (dob) {
    const now = new Date();
    if (dob.getTime() > now.getTime()) {
      errors.push('Ngày sinh không được ở tương lai');
    } else {
      const age = now.getUTCFullYear() - dob.getUTCFullYear();
      if (age > MAX_AGE_YEARS) errors.push(`Ngày sinh không hợp lệ (quá ${MAX_AGE_YEARS} tuổi)`);
      else if (age < MIN_AGE_YEARS) errors.push('Ngày sinh không hợp lệ');
    }
  }

  const email = clean(data.email);
  if (email) {
    if (email.length > EMAIL_MAX) errors.push(`Email tối đa ${EMAIL_MAX} ký tự`);
    else if (!isValidEmail(email)) errors.push(`Email không hợp lệ. ${EMAIL_HINT}`);
  }

  const address = clean(data.address);
  if (address.length > ADDRESS_MAX) errors.push(`Địa chỉ tối đa ${ADDRESS_MAX} ký tự`);

  const taxCode = clean(data.taxCode);
  if (taxCode && !TAX_CODE_REGEX.test(taxCode)) errors.push('Mã số thuế phải gồm 10 chữ số (hoặc 10 số-3 số)');

  const contactName = clean(data.contactName);
  if (contactName) {
    if (contactName.length > CONTACT_NAME_MAX) errors.push(`Tên người liên hệ tối đa ${CONTACT_NAME_MAX} ký tự`);
    else if (!PERSON_NAME_REGEX.test(contactName)) errors.push('Tên người liên hệ chỉ gồm chữ cái, khoảng trắng hoặc dấu gạch');
  }

  const contactPhone = clean(data.contactPhone);
  if (contactPhone && !isValidPhone(contactPhone)) errors.push('SĐT người liên hệ không hợp lệ');

  return errors;
}

// ── Xe ───────────────────────────────────────────────────────────────────
// Bien so VN: 2 so tinh + 1-2 chu (co the kem 1 so) + 4-5 so serial, viet
// dang "30A-123.45" hoac "30A-02465" - dung CHUNG BIEN_SO_REGEX/normalizeBienSo
// voi form quyet toan (RepairSettlementService), xem giai thich o fieldValidation.js.
const PLATE_MAX = 20;            // vehicles.license_plate varchar(20)
const VIN_MAX = 50;              // frame_number / engine_number varchar(50)
const COLOR_MAX = 50;            // vehicles.color nvarchar(50)
const KM_MAX = 2000000;          // xe chay het doi cung khong toi 2 trieu km
const YEAR_MIN = 1980;
// Chi chu/so, khong khoang trang - so khung (VIN) va so may deu dang nay.
const VIN_REGEX = /^[A-Z0-9]+$/;

function normalizePlate(v) {
  return normalizeBienSo(v);
}

/**
 * Rang buoc them xe cho khach. Loai xe BAT BUOC chon tu catalog (modelId) -
 * khong go tay, de con loc goi bao duong va tra dinh muc phu tung theo doi xe.
 * @returns {string[]} mang loi (rong = hop le)
 */
function getVehicleFieldErrors(data = {}) {
  const errors = [];

  const plate = normalizePlate(data.licensePlate);
  if (!plate) errors.push('Biển số xe không được để trống');
  else if (plate.length > PLATE_MAX) errors.push(`Biển số tối đa ${PLATE_MAX} ký tự`);
  else if (!BIEN_SO_REGEX.test(plate)) errors.push('Biển số không đúng định dạng (VD: 30A-123.45 hoặc 30A-02465)');

  const modelId = Number(data.modelId);
  if (!Number.isInteger(modelId) || modelId <= 0) errors.push('Vui lòng chọn dòng xe');

  // So khung (VIN) chuan quoc te DUNG 17 ky tu - khac so may (khong co
  // chuan do dai chung, xem VIN_REGEX ben duoi).
  const frame = clean(data.frameNumber).toUpperCase();
  if (frame && !FRAME_NUMBER_REGEX.test(frame)) {
    errors.push('Số khung phải gồm đúng 17 ký tự chữ và số (chuẩn VIN)');
  }

  const engine = clean(data.engineNumber).toUpperCase();
  if (engine) {
    if (engine.length > VIN_MAX) errors.push(`Số máy tối đa ${VIN_MAX} ký tự`);
    else if (!VIN_REGEX.test(engine)) errors.push('Số máy chỉ gồm chữ và số');
  }

  if (data.manufactureYear !== undefined && data.manufactureYear !== null && data.manufactureYear !== '') {
    const year = Number(data.manufactureYear);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < YEAR_MIN || year > maxYear) {
      errors.push(`Năm sản xuất phải từ ${YEAR_MIN} đến ${maxYear}`);
    }
  }

  if (clean(data.color).length > COLOR_MAX) errors.push(`Màu xe tối đa ${COLOR_MAX} ký tự`);

  if (data.currentKm !== undefined && data.currentKm !== null && data.currentKm !== '') {
    const km = Number(data.currentKm);
    if (!Number.isInteger(km) || km < 0) errors.push('Số km hiện tại phải là số nguyên không âm');
    else if (km > KM_MAX) errors.push(`Số km hiện tại vượt quá mức hợp lý (tối đa ${KM_MAX.toLocaleString('vi-VN')} km)`);
  }

  return errors;
}

module.exports = {
  getCustomerFieldErrors, getVehicleFieldErrors, normalizePlate,
  CCCD_REGEX, TAX_CODE_REGEX, BIEN_SO_REGEX, NAME_MIN, NAME_MAX, ADDRESS_MAX, KM_MAX,
};
