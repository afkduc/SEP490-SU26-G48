export const ROUTES = Object.freeze({
  LOGIN: '/login',
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '*',

  DASHBOARD: '/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
    GENERAL_DIRECTOR_SETTLEMENTS: '/general-director/reports/settlements',


  ADMIN_USERS: '/admin/users',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_LOGS: '/admin/logs',
  ADMIN_LOGIN_SESSIONS: '/admin/logs/login',

  INVENTORY: '/inventory',

  REPAIR_SETTLEMENT: '/repair-settlement',
  MAINTENANCE: '/maintenance',
  CUSTOMER_CARE: '/customer-care',
  CUSTOMERS: '/customers',
  SERVICES: '/services',
});

export const DEFAULT_ROUTE = ROUTES.DASHBOARD;