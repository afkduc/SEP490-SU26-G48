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
 * - production build: luôn '/crm'
 */
export const BASE_PATH = import.meta.env.DEV ? fromVite : '/crm';

/**
 * Prefix khi GHI URL trình duyệt.
 * Production LUÔN '/crm' — không phụ thuộc detect runtime / Vite edge-case.
 */
export function getCrmPrefix() {
  if (import.meta.env.DEV) return fromVite || '';
  return '/crm';
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
