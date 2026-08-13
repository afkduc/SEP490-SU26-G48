// SQL Server 'datetime' khong luu mui gio, va driver mssql (tedious, useUTC
// mac dinh true) doc/ghi cot nay theo TRUC UTC cua JS Date - bat ke may chu
// Node hay SQL Server dang chay o mui gio he thong nao. Neu dung GETDATE() o
// SQL Server (phu thuoc dong ho he dieu hanh cua may chu DB) hoac dung
// `new Date().getHours()` o Node (phu thuoc mui gio he dieu hanh cua may chu
// BE), gio hien thi co the bi lech neu 1 trong 2 may khong dat mui gio VN.
//
// Cach lam an toan, khong phu thuoc cau hinh ha tang: tu tinh gio VIET NAM
// THAT (Asia/Ho_Chi_Minh) tai tang ung dung bang Intl API (luon dung, khong
// phu thuoc TZ cua process), roi dung Date.UTC(...) de tao 1 Date co truc UTC
// dung bang cac con so gio VN do - ghi thang gia tri nay vao cot datetime.
// Khi doc lai, dung .getUTCXxx() (KHONG dung .getXxx() local) se ra dung lai
// cac con so da ghi, bat ke may chu nao dang chay o dau.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function nowVN() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date()).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour; // hour12:false co the tra ve "24" cho 0h

  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(hour), Number(parts.minute), Number(parts.second)
  ));
}

/** Calendar YYYY-MM-DD theo Asia/Ho_Chi_Minh (khong phu thuoc TZ process). */
function todayYmdVN(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * 00:00:00.000 VN cua ngay YYYY-MM-DD, bieu dien bang instant UTC that
 * (de so sanh voi cot ghi SYSUTCDATETIME()).
 * Vi du 2026-08-14 → 2026-08-13T17:00:00.000Z
 */
function startOfDayVN(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - VN_OFFSET_MS);
}

/**
 * 23:59:59.999 VN cua ngay YYYY-MM-DD, bieu dien bang instant UTC that.
 * Vi du 2026-08-14 → 2026-08-14T16:59:59.999Z
 */
function endOfDayVN(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - VN_OFFSET_MS - 1);
}

function parseInstant(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Parse from/to (YYYY-MM-DD hoac ISO) thanh khoang UTC de loc cot SYSUTCDATETIME.
 * Date-only duoc hieu la ngay lich VN (UTC+7), KHONG phai nua dem UTC —
 * tranh "Hôm nay" trong luc 00:00–07:00 VN bi trong.
 */
function parseUtcRangeFromVnDates(fromDate, toDate) {
  const from = typeof fromDate === 'string' && DATE_ONLY_RE.test(fromDate)
    ? startOfDayVN(fromDate)
    : parseInstant(fromDate);
  const to = typeof toDate === 'string' && DATE_ONLY_RE.test(toDate)
    ? endOfDayVN(toDate)
    : parseInstant(toDate);
  const hasRange = Boolean(from && to);
  return { from, to, hasRange };
}

module.exports = {
  nowVN,
  todayYmdVN,
  startOfDayVN,
  endOfDayVN,
  parseUtcRangeFromVnDates,
};
