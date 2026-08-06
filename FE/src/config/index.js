export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Khớp vite.config.js `base`. Production mặc định /crm.
const viteBase = import.meta.env.BASE_URL || '/';
const fromVite = viteBase === '/' ? '' : viteBase.replace(/\/$/, '');

/**
 * Prefix CRM cho BrowserRouter basename.
 * Production luôn '/crm' (kể cả khi BASE_URL lệch).
 */
export const BASE_PATH = import.meta.env.PROD
  ? (fromVite || '/crm')
  : fromVite;

/**
 * Prefix dùng khi GHI URL trình duyệt — ưu tiên phát hiện runtime
 * (script /crm/assets/..., location đang ở /crm, ...) để không bao giờ
 * ghi /admin/... thiếu /crm khi app đang chạy dưới /crm.
 */
export function getCrmPrefix() {
  if (typeof window !== 'undefined') {
    try {
      const path = window.location.pathname || '';
      if (path === '/crm' || path.startsWith('/crm/')) return '/crm';

      // index.html load bundle từ /crm/assets/...
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i += 1) {
        const src = scripts[i].getAttribute('src') || scripts[i].src || '';
        if (src.includes('/crm/')) return '/crm';
      }

      if (typeof document !== 'undefined' && document.baseURI) {
        const base = new URL(document.baseURI);
        if (base.pathname === '/crm' || base.pathname.startsWith('/crm/')) return '/crm';
      }
    } catch {
      /* ignore */
    }
  }

  if (import.meta.env.PROD) return '/crm';
  return BASE_PATH || '';
}

export const APP_NAME = 'SEP490-G48';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};
