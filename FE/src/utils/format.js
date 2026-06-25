export function formatDate(value, locale = 'vi-VN') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale);
}

export function formatCurrency(value, currency = 'VND', locale = 'vi-VN') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}
