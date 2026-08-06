export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const viteBase = import.meta.env.BASE_URL || '/';
const fromVite = viteBase === '/' ? '' : viteBase.replace(/\/$/, '');

/**
 * Basename cho BrowserRouter.
 * - npm run dev (DEV): '' (localhost:3000/admin/...)
 * - production build: luôn '/crm'
 */
export const BASE_PATH = import.meta.env.DEV ? fromVite : '/crm';

/**
 * Prefix khi GHI URL trình duyệt.
 * Production/build luôn '/crm' — không phụ thuộc detect runtime (tránh filter mất /crm).
 * Dev local giữ '' trừ khi Vite base là /crm/.
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
