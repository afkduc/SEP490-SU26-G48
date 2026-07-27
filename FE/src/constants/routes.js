export const ROUTES = Object.freeze({
  LOGIN: '/login',
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '*',

  DASHBOARD: '/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
    GENERAL_DIRECTOR_SETTLEMENTS: '/general-director/reports/settlements',


  ADMIN_USERS: '/admin/users',
  ADMIN_LOGS: '/admin/logs',
  ADMIN_LOGIN_SECURITY: '/admin/login-security',
  ADMIN_LOGIN_SESSIONS: '/admin/login-security?tab=sessions',
  ADMIN_CATALOG: '/admin/catalog',
  ADMIN_PROFILE: '/admin/profile',

  MANAGER_PROFILE: '/manager/profile',
  DIRECTOR_PROFILE: '/general-director/profile',
  DASHBOARD_PROFILE: '/dashboard/profile',
  REPAIR_ORDERS_PROFILE: '/repair-orders/profile',
  INVENTORY_PROFILE: '/inventory/profile',
  TECHNICIAN_PROFILE: '/technician/profile',

  INVENTORY: '/inventory',

  REPAIR_SETTLEMENT: '/repair-settlement',
  MAINTENANCE: '/maintenance',
  CUSTOMER_CARE: '/customer-care',
  CUSTOMERS: '/customers',
  SERVICES: '/services',
});

export const DEFAULT_ROUTE = ROUTES.DASHBOARD;