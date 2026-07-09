import { ROLES, ROUTES, DEFAULT_ROUTE } from '../constants';

const ROLE_TO_DEFAULT_ROUTE = Object.freeze({
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.GENERAL_DIRECTOR]: ROUTES.GENERAL_DIRECTOR_SETTLEMENTS,
  [ROLES.MANAGER]: ROUTES.DASHBOARD,
  [ROLES.SERVICE_ADVISOR]: ROUTES.DASHBOARD,
  [ROLES.TEAM_LEADER]: ROUTES.DASHBOARD,
  [ROLES.WAREHOUSE_STAFF]: ROUTES.DASHBOARD,
  [ROLES.ACCOUNTANT]: ROUTES.DASHBOARD,
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
  const primaryRole = user?.primaryRole ?? user?.role ?? user?.roles?.[0];
  return getDefaultRouteByRole(primaryRole);
}