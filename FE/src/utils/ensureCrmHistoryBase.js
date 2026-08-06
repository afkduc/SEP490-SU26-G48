import { BASE_PATH } from '../config';

/**
 * Chặn History API ghi URL tuyệt đối thiếu basename /crm (production).
 * Bug cũ: window.history.replaceState(..., location.pathname + '?...') với
 * pathname của React Router (/admin/...) → mất /crm → F5 ra 404 Landing.
 * React Router khi navigate đúng vẫn truyền sẵn /crm/... nên không bị double.
 */
export function ensureCrmHistoryBase() {
  if (!BASE_PATH || typeof window === 'undefined' || !window.history) return;

  const prefix = BASE_PATH;
  const origReplace = window.history.replaceState.bind(window.history);
  const origPush = window.history.pushState.bind(window.history);

  const fixUrl = (url) => {
    if (typeof url !== 'string' || !url.startsWith('/')) return url;
    if (url === prefix || url.startsWith(`${prefix}/`)) return url;
    if (url.startsWith('/api')) return url;
    return `${prefix}${url}`;
  };

  window.history.replaceState = (state, title, url) => {
    origReplace(state, title, url == null ? url : fixUrl(url));
  };
  window.history.pushState = (state, title, url) => {
    origPush(state, title, url == null ? url : fixUrl(url));
  };

  // Sửa luôn thanh địa chỉ nếu đã bị lệch trước khi patch chạy
  const { pathname, search, hash } = window.location;
  if (
    pathname.startsWith('/')
    && pathname !== prefix
    && !pathname.startsWith(`${prefix}/`)
    && !pathname.startsWith('/api')
  ) {
    // Chỉ sửa các path nội bộ CRM (tránh đụng Landing: /, /gioi-thieu, ...)
    const crmRoots = [
      '/admin',
      '/login',
      '/unauthorized',
      '/manager',
      '/inventory',
      '/repair',
      '/technician',
      '/customer',
      '/profile',
      '/team-leader',
      '/warehouse',
      '/cashier',
      '/receptionist',
    ];
    if (crmRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))) {
      origReplace(null, '', `${prefix}${pathname}${search}${hash}`);
    }
  }
}
