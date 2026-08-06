export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Khớp vite.config.js `base`: build production = "/crm/", dev = "/".
// Dùng BASE_URL của Vite (không chỉ PROD) để basename BrowserRouter luôn đúng.
const viteBase = import.meta.env.BASE_URL || '/';
export const BASE_PATH = viteBase === '/' ? '' : viteBase.replace(/\/$/, '');

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
