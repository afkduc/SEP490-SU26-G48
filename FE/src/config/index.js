export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// He thong quan ly noi bo dat duoi "/crm" tren production (Landing chiem goc
// domain, xem Landing/app/config.js + nginx.conf location /crm) - rong luc
// "npm run dev" de giu nguyen thoi quen chay local o localhost:3000/... hien
// tai. Phai khop voi "base" trong vite.config.js.
export const BASE_PATH = import.meta.env.PROD ? '/crm' : '';

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
