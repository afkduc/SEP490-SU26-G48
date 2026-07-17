const ExcelJS = require('exceljs');

const TITLE_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEEF2FF' },
};

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' },
};

const HEADER_FONT = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const DATE_FORMAT = 'dd/MM/yyyy HH:mm';

function formatDateValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d;
}

function setTitleRow(worksheet, lastColLetter, titleText, subtitleText) {
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = titleText;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = TITLE_FILL;
  worksheet.getRow(1).height = 28;

  if (subtitleText) {
    worksheet.mergeCells(`A2:${lastColLetter}2`);
    const sub = worksheet.getCell('A2');
    sub.value = subtitleText;
    sub.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    sub.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 18;
  }
}

function styleHeaderRow(worksheet, headerRowIndex, columnCount) {
  const row = worksheet.getRow(headerRowIndex);
  row.height = 22;
  for (let i = 1; i <= columnCount; i++) {
    const cell = row.getCell(i);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  }
}

function styleDataRows(worksheet, firstRow, lastRow, columnCount) {
  for (let r = firstRow; r <= lastRow; r++) {
    const row = worksheet.getRow(r);
    for (let i = 1; i <= columnCount; i++) {
      const cell = row.getCell(i);
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      if (r % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    }
  }
}

function autoWidth(worksheet, columns) {
  columns.forEach((col, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    let max = col.header ? col.header.length : 10;
    if (col.width) {
      worksheet.getColumn(colLetter).width = col.width;
      return;
    }
    worksheet.getColumn(colLetter).width = Math.min(Math.max(max + 4, 12), 40);
  });
}

function columnLetter(index) {
  let letter = '';
  let i = index;
  while (i > 0) {
    const rem = (i - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    i = Math.floor((i - 1) / 26);
  }
  return letter;
}

function writeRows(worksheet, startRow, columns, items, rowMapper) {
  if (!items || items.length === 0) return startRow;
  items.forEach((item, idx) => {
    const row = worksheet.getRow(startRow + idx);
    const values = rowMapper(item);
    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const raw = values[cIdx];
      if (col.format === 'date') {
        const d = formatDateValue(raw);
        if (d) {
          cell.value = d;
          cell.numFmt = DATE_FORMAT;
        } else {
          cell.value = '';
        }
      } else {
        cell.value = raw == null ? '' : raw;
      }
    });
  });
  return startRow + items.length;
}

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
};

const ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  ASSIGN: 'Gán quyền',
  REVOKE: 'Thu hồi quyền',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  ACTIVATE: 'Kích hoạt',
  DEACTIVATE: 'Ngừng hoạt động',
  LOCK: 'Khóa',
  UNLOCK: 'Mở khóa',
};

const USER_COLUMNS = [
  { header: 'STT', width: 6 },
  { header: 'ID', width: 8 },
  { header: 'Tên đăng nhập', width: 18 },
  { header: 'Họ', width: 14 },
  { header: 'Tên', width: 14 },
  { header: 'Email', width: 28 },
  { header: 'Số điện thoại', width: 14 },
  { header: 'Chi nhánh', width: 22 },
  { header: 'Vai trò', width: 28 },
  { header: 'Trạng thái', width: 16 },
  { header: 'Ngày tạo', width: 18, format: 'date' },
];

function mapUserRow(user, idx) {
  const roles = Array.isArray(user.roles)
    ? user.roles
        .map((r) => (typeof r === 'object' && r !== null ? r.roleName : r))
        .filter(Boolean)
        .join(', ')
    : '';
  return [
    idx + 1,
    user.id,
    user.name || user.user_name || '',
    user.firstName || '',
    user.lastName || '',
    user.email || '',
    user.phone || '',
    user.branchName || '',
    roles,
    STATUS_LABELS[user.status] || user.status || '',
    user.createdAt,
  ];
}

async function exportUsersToExcel(rows, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AutoGara';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Danh sách người dùng', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  const filterDescs = [];
  if (filters.search) filterDescs.push(`Tìm kiếm: "${filters.search}"`);
  if (filters.status) filterDescs.push(`Trạng thái: ${STATUS_LABELS[filters.status] || filters.status}`);
  if (filters.branchId) filterDescs.push(`Chi nhánh ID: ${filters.branchId}`);
  if (filters.roleId) filterDescs.push(`Vai trò ID: ${filters.roleId}`);

  const subtitleParts = [`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`];
  if (filterDescs.length) subtitleParts.push(`Bộ lọc: ${filterDescs.join(' | ')}`);
  subtitleParts.push(`Tổng: ${rows.length} tài khoản`);

  setTitleRow(worksheet, columnLetter(USER_COLUMNS.length), 'BÁO CÁO DANH SÁCH NGƯỜI DÙNG', subtitleParts.join(' - '));
  const headerRow = worksheet.getRow(4);
  USER_COLUMNS.forEach((col, idx) => { headerRow.getCell(idx + 1).value = col.header; });
  styleHeaderRow(worksheet, 4, USER_COLUMNS.length);
  autoWidth(worksheet, USER_COLUMNS);

  const lastDataRow = writeRows(worksheet, 5, USER_COLUMNS, rows, mapUserRow);
  if (lastDataRow > 5) {
    styleDataRows(worksheet, 5, lastDataRow - 1, USER_COLUMNS.length);
  }

  return workbook.xlsx.writeBuffer();
}

const AUDIT_COLUMNS = [
  { header: 'STT', width: 6 },
  { header: 'Thời gian', width: 20, format: 'date' },
  { header: 'Người dùng', width: 22 },
  { header: 'Số điện thoại', width: 14 },
  { header: 'Hành động', width: 16 },
  { header: 'Bảng', width: 22 },
  { header: 'Mã bản ghi', width: 16 },
  { header: 'IP', width: 16 },
  { header: 'Phương thức', width: 12 },
  { header: 'URL', width: 32 },
  { header: 'Mã phản hồi', width: 12 },
  { header: 'Thời gian xử lý (ms)', width: 18 },
  { header: 'Mô tả', width: 30 },
];

function mapAuditRow(log, idx) {
  const actionKey = String(log.action || '').toUpperCase();
  let label = ACTION_LABELS[actionKey];
  if (!label) {
    if (actionKey.includes('CREATE')) label = 'Tạo mới';
    else if (actionKey.includes('UPDATE')) label = 'Cập nhật';
    else if (actionKey.includes('DELETE')) label = 'Xóa';
    else label = actionKey;
  }
  return [
    idx + 1,
    log.logged_at,
    log.user_name || '',
    log.phone_number || '',
    label,
    log.table_name || log.entity_name || '',
    log.entity_code || (log.record_id ? `#${log.record_id}` : ''),
    log.ip_address || '',
    log.request_method || '',
    log.request_url || '',
    log.response_status == null ? '' : log.response_status,
    log.duration_ms == null ? '' : log.duration_ms,
    log.description || '',
  ];
}

async function exportAuditLogsToExcel(rows, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AutoGara';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Nhật ký hoạt động', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  const filterDescs = [];
  if (filters.userName) filterDescs.push(`Người dùng: "${filters.userName}"`);
  if (filters.phone) filterDescs.push(`SĐT: "${filters.phone}"`);
  if (filters.action) filterDescs.push(`Hành động: ${filters.action}`);
  if (filters.entityName) filterDescs.push(`Bảng: "${filters.entityName}"`);
  if (filters.entityCode) filterDescs.push(`Mã: "${filters.entityCode}"`);
  if (filters.startDate) filterDescs.push(`Từ: ${filters.startDate}`);
  if (filters.endDate) filterDescs.push(`Đến: ${filters.endDate}`);
  if (filters.branchId) filterDescs.push(`Chi nhánh ID: ${filters.branchId}`);

  const subtitleParts = [`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`];
  if (filterDescs.length) subtitleParts.push(`Bộ lọc: ${filterDescs.join(' | ')}`);
  subtitleParts.push(`Tổng: ${rows.length} bản ghi`);

  setTitleRow(worksheet, columnLetter(AUDIT_COLUMNS.length), 'BÁO CÁO NHẬT KÝ HOẠT ĐỘNG', subtitleParts.join(' - '));
  const headerRow = worksheet.getRow(4);
  AUDIT_COLUMNS.forEach((col, idx) => { headerRow.getCell(idx + 1).value = col.header; });
  styleHeaderRow(worksheet, 4, AUDIT_COLUMNS.length);
  autoWidth(worksheet, AUDIT_COLUMNS);

  const lastDataRow = writeRows(worksheet, 5, AUDIT_COLUMNS, rows, mapAuditRow);
  if (lastDataRow > 5) {
    styleDataRows(worksheet, 5, lastDataRow - 1, AUDIT_COLUMNS.length);
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  exportUsersToExcel,
  exportAuditLogsToExcel,
};