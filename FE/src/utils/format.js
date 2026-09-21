export function formatDate(value, locale = 'vi-VN') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale);
}

export function formatDateTime(value, locale = 'vi-VN') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}

// 'YYYY-MM-DD' theo GIO MAY - dung cho <input type="date"> va tham so
// fromDate/toDate gui len BE. KHONG dung toISOString().slice(0, 10): no doi
// sang UTC nen tu 0h den 7h sang (VN = UTC+7) se ra ngay HOM QUA -> dashboard
// "Thang nay" bi thieu phieu tiep nhan trong ngay, ngay mac dinh cua form lui
// 1 ngay.
export function toLocalISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCurrency(value, currency = 'VND', locale = 'vi-VN') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}
