export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Vite inject BASE_URL từ vite.config `base`:
 * - build: '/crm/'
 * - dev: '/'
 */
const viteBaseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const fromVite = viteBaseUrl === '/' ? '' : viteBaseUrl;

/**
 * Basename cho BrowserRouter.
 * - npm run dev: '' (localhost:3000/admin/...)
 * - production build: luôn '/crm' (khớp Vite base)
 */
export const BASE_PATH = import.meta.env.DEV ? fromVite : (fromVite || '/crm');

/**
 * Prefix khi GHI URL trình duyệt: /crm + /admin/users + ?roleId=...
 * Production lấy từ Vite BASE_URL (ổn định hơn detect runtime).
 */
export function getCrmPrefix() {
  if (import.meta.env.DEV) return fromVite || '';
  return fromVite || '/crm';
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
