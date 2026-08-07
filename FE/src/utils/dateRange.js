/**
 * Chuẩn hóa khoảng ngày (input type="date" → yyyy-mm-dd).
 * Nếu start > end thì đổi chỗ cho nhau.
 */
export function normalizeDateRange(startDate, endDate) {
  const start = startDate || '';
  const end = endDate || '';
  if (start && end && start > end) {
    return { startDate: end, endDate: start, swapped: true };
  }
  return { startDate: start, endDate: end, swapped: false };
}

/**
 * Cập nhật 1 đầu của khoảng ngày; tự swap nếu start > end.
 * @param {'start'|'end'} which
 * @param {string} value
 * @param {{ startDate?: string, endDate?: string }} current
 * @param {{ startKey?: string, endKey?: string }} [keys]
 */
export function nextDateRangeState(which, value, current = {}, keys = {}) {
  const startKey = keys.startKey || 'startDate';
  const endKey = keys.endKey || 'endDate';
  const start = which === 'start' ? (value || '') : (current[startKey] || '');
  const end = which === 'end' ? (value || '') : (current[endKey] || '');
  const normalized = normalizeDateRange(start, end);
  return {
    [startKey]: normalized.startDate,
    [endKey]: normalized.endDate,
    swapped: normalized.swapped,
  };
}
