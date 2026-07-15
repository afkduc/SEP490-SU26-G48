const ExcelJS = require('exceljs');
const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');

const PHONE_REGEX = /^0[0-9]{9,10}$/;
const MAX_ROWS = 1000;

// Tu khoa nhan dien ten cot (da chuan hoa: khong dau, chu thuong, khong khoang trang/dau cau)
// -> field key dung noi bo. Cho phep nguoi dung dat ten cot linh hoat mien la
// khop 1 trong cac alias nay.
const HEADER_ALIASES = {
  fullName: ['hovaten', 'hoten', 'tenkhachhang', 'ten'],
  phone: ['sodienthoai', 'sdt', 'dienthoai'],
  cccd: ['cccd', 'cmnd', 'socccd'],
  dateOfBirth: ['ngaysinh'],
  email: ['email'],
  address: ['diachi'],
  taxCode: ['masothue', 'mst'],
  contactName: ['nguoilienhe', 'tennguoilienhe'],
  contactPhone: ['sdtnguoilienhe', 'dienthoainguoilienhe', 'sodienthoainguoilienhe'],
  licensePlate: ['bienso', 'biensoxe'],
  vehicleModel: ['dongxe', 'loaixe', 'tenxe', 'dongxeloaixe'],
  frameNumber: ['sokhung'],
  engineNumber: ['somay'],
  manufactureYear: ['namsanxuat', 'nam'],
  color: ['mau', 'mausac'],
  currentKm: ['sokmhientai', 'kmhientai', 'sokm', 'km'],
};

function normalizeHeader(text) {
  return normalizeVietnamese(text).replace(/[^a-z0-9]/g, '');
}

function rawValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return v.text;
    if (v.result != null) return v.result;
    return null;
  }
  return v;
}

function toStr(v) {
  if (v == null || v instanceof Date) return '';
  return String(v).trim();
}

function toDate(v) {
  if (v == null || v === '') return null;
  // mssql/tedious mac dinh serialize Date qua cac getter UTC (useUTC: true),
  // nen phai dung Date.UTC() khi tu dung chuoi de tranh lech 1 ngay theo TZ server.
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildHeaderIndex(worksheet) {
  const headerRow = worksheet.getRow(1);
  const index = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const norm = normalizeHeader(toStr(rawValue(cell)));
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (index[field] === undefined && aliases.includes(norm)) {
        index[field] = colNumber;
      }
    }
  });
  return index;
}

// Doc buffer file Excel (.xlsx) va tra ve danh sach dong da chuan hoa + loi
// validate co ban (khong dong cham DB o day - viec kiem tra trung SDT/bien so
// do repository dam nhiem trong transaction rieng cho tung dong).
async function parseCustomerImportFile(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ApiError(400, 'File không đúng định dạng Excel (.xlsx)');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new ApiError(400, 'File Excel không có dữ liệu');
  }

  const colIndex = buildHeaderIndex(worksheet);
  if (colIndex.fullName === undefined || colIndex.phone === undefined) {
    throw new ApiError(400, 'File Excel thiếu cột "Họ và tên" hoặc "Số điện thoại"');
  }

  if (worksheet.rowCount - 1 > MAX_ROWS) {
    throw new ApiError(400, `File có quá nhiều dòng (tối đa ${MAX_ROWS} dòng/lần import)`);
  }

  const rows = [];
  for (let r = 2; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const get = (field) => (colIndex[field] !== undefined ? rawValue(row.getCell(colIndex[field])) : null);

    const fullName = toStr(get('fullName'));
    const phone = toStr(get('phone'));
    const licensePlate = toStr(get('licensePlate')).toUpperCase();

    if (!fullName && !phone && !licensePlate) continue; // dòng trống bỏ qua, không tính vào kết quả

    const errors = [];
    if (!fullName) errors.push('Thiếu họ và tên');
    if (!phone || !PHONE_REGEX.test(phone)) errors.push('Số điện thoại không hợp lệ');
    if (!licensePlate) errors.push('Thiếu biển số xe');

    rows.push({
      rowNumber: r,
      errors,
      payload: {
        fullName,
        phone,
        cccd: toStr(get('cccd')) || null,
        dateOfBirth: toDate(get('dateOfBirth')),
        email: toStr(get('email')) || null,
        address: toStr(get('address')) || null,
        taxCode: toStr(get('taxCode')) || null,
        contactName: toStr(get('contactName')) || null,
        contactPhone: toStr(get('contactPhone')) || null,
        licensePlate,
        vehicleModel: toStr(get('vehicleModel')) || null,
        frameNumber: toStr(get('frameNumber')) || null,
        engineNumber: toStr(get('engineNumber')) || null,
        manufactureYear: toInt(get('manufactureYear')),
        color: toStr(get('color')) || null,
        currentKm: toInt(get('currentKm')) || 0,
      },
    });
  }

  return rows;
}

module.exports = { parseCustomerImportFile, PHONE_REGEX };
