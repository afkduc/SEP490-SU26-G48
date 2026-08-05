import { ROLES, ROUTES, DEFAULT_ROUTE } from '../constants';
import { getRoleHome } from '../contexts/AppContext';

const ROLE_TO_DEFAULT_ROUTE = Object.freeze({
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.GENERAL_DIRECTOR]: '/general-director',
  [ROLES.MANAGER]: '/manager',
  [ROLES.SERVICE_ADVISOR]: ROUTES.REPAIR_SETTLEMENT,
  [ROLES.TEAM_LEADER]: '/repair-orders',
  [ROLES.TECHNICIAN]: '/repair-orders',
  [ROLES.WAREHOUSE_STAFF]: ROUTES.INVENTORY,
});

export function getDefaultRouteByRole(role) {
  if (!role) return DEFAULT_ROUTE;
  return ROLE_TO_DEFAULT_ROUTE[role] ?? DEFAULT_ROUTE;
}

export function hasRole(user, allowedRoles) {
  if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }
  const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
  return userRoles.some((r) => allowedRoles.includes(r));
}

export function routeAfterLogin(user) {
  return getRoleHome(user);
}