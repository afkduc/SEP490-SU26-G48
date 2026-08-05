const ApiError = require('./ApiError');

function parseOptionalDate(value, fieldName) {
  if (value == null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} không hợp lệ`);
  }
  return date;
}

function normalizeDateRange(fromDate, toDate) {
  const from = parseOptionalDate(fromDate, 'Ngày bắt đầu');
  const to = parseOptionalDate(toDate, 'Ngày kết thúc');
  if (from && to && from > to) {
    throw new ApiError(400, 'Ngày bắt đầu không được lớn hơn ngày kết thúc');
  }
  return { fromDate: from, toDate: to };
}

module.exports = { normalizeDateRange };
