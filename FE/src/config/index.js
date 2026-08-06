export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Khớp vite.config.js `base`: build production = "/crm/", dev = "/".
// Production luôn có /crm (fallback nếu BASE_URL lệch).
const viteBase = import.meta.env.BASE_URL || '/';
const fromVite = viteBase === '/' ? '' : viteBase.replace(/\/$/, '');
export const BASE_PATH = import.meta.env.PROD
  ? (fromVite || '/crm')
  : fromVite;

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
