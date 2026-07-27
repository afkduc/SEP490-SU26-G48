/**
 * Date/time utilities cho FE.
 *
 * Tat ca datetime tu BE tra ve o dang ISO8601 UTC (vi du '2026-07-19T11:25:14.613Z').
 * FE parse bang `new Date()` (luon dung UTC ben trong), sau do format theo
 * timezone mong muon.
 *
 * Bug lich su: cac helper cu hardcode 'Asia/Ho_Chi_Minh' hoac khong set
 * timeZone, dan den hien thi sai khi browser o mu gio khac. Helper nay luon
 * dinh nghia timezone ro rang va check NaN truoc khi format.
 */

/**
 * Tra ve Date object tu nhieu dinh dang:
 *   - ISO string ('2026-07-19T11:25:14.613Z')
 *   - Date object
 *   - null/undefined
 * Tra ve null neu khong parse duoc (Invalid Date).
 */
export function parseDateSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format date theo timezone chi dinh (mac dinh 'Asia/Ho_Chi_Minh').
 * Tra ve '—' neu value null/invalid.
 *
 * @param {string|Date|null|undefined} value
 * @param {object} options
 * @param {string} options.timeZone - IANA timezone, mac dinh Asia/Ho_Chi_Minh
 * @param {string} options.locale   - BCP47 locale, mac dinh 'vi-VN'
 * @param {boolean} options.withSeconds
 */
export function formatDateSafe(value, options = {}) {
  const {
    timeZone = 'Asia/Ho_Chi_Minh',
    locale = 'vi-VN',
    withSeconds = false,
  } = options;

  const d = parseDateSafe(value);
  if (!d) return '—';

  const fmt = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    timeZone,
  };

  try {
    return d.toLocaleString(locale, fmt);
  } catch {
    // Neu timezone khong hop le (vi du server tra 'Asia/Invalid'), fallback
    // khong truyen timeZone de browser tu quyet dinh theo may client.
    const { timeZone: _omit, ...rest } = fmt;
    return d.toLocaleString(locale, rest);
  }
}

/**
 * Tuong tu formatDateSafe nhung chi tra ve phan ngay (dd/MM/yyyy).
 */
export function formatDateOnly(value, options = {}) {
  const {
    timeZone = 'Asia/Ho_Chi_Minh',
    locale = 'vi-VN',
  } = options;

  const d = parseDateSafe(value);
  if (!d) return '—';

  try {
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone,
    });
  } catch {
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}

/**
 * Khoang cach tu bay gio den value (giay). Am neu value la tuong lai.
 * Tra ve null neu value invalid.
 */
export function secondsSince(value, nowMs = Date.now()) {
  const d = parseDateSafe(value);
  if (!d) return null;
  return Math.floor((nowMs - d.getTime()) / 1000);
}

/**
 * Tinh clock offset giua server va client (ms).
 *   offsetMs = serverTimeMs - clientTimeMs (luc goi API)
 * De hien thi dung, cong offset vao cac Date tao local:
 *   const adjustedDate = new Date(localDate.getTime() + offsetMs);
 *
 * @param {string} serverIso - ISO8601 UTC string tu BE
 * @param {number} clientMsAtCall - Date.now() luc FE gui request
 */
export function computeClockOffsetMs(serverIso, clientMsAtCall = Date.now()) {
  const d = parseDateSafe(serverIso);
  if (!d) return 0;
  return d.getTime() - clientMsAtCall;
}

/**
 * Lay clock offset tu storage (set boi AppContext sau login).
 * Tra ve 0 neu chua co (lan dau load page, chua login).
 */
export function getClockOffsetMs() {
  try {
    const raw = sessionStorage.getItem('clockOffset') || localStorage.getItem('clockOffset');
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Tuong tu formatDateSafe nhung AP DUNG clock offset (server - client).
 * Muc dich: dam bao cac timestamp tu server duoc hien thi dung theo
 * may client, ke ca khi may client set sai gio he thong.
 *
 * Vi du: BE tra login_time = '2026-07-19T11:25:14.613Z'. May client
 * co system clock cham 5 phut. Binh thuong hien thi 11:20 (sai).
 * Voi formatDateSafeWithOffset, se hien thi 11:25 (dung theo server).
 */
export function formatDateSafeWithOffset(value, options = {}) {
  const offset = getClockOffsetMs();
  if (offset === 0) return formatDateSafe(value, options);

  const d = parseDateSafe(value);
  if (!d) return '—';
  // Cong offset vao Date de "dich" thoi gian theo server
  const adjusted = new Date(d.getTime() + offset);
  return formatDateSafe(adjusted, options);
}