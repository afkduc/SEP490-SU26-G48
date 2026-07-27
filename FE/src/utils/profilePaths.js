import { ROLE_PROFILE_CONFIG } from '../config/roleProfileConfig';

export const ROLE_PROFILE_BASE_PATHS = Object.freeze(
  Object.values(ROLE_PROFILE_CONFIG).map((cfg) => cfg.profilePath),
);

export function isRoleProfilePath(pathname = '') {
  return ROLE_PROFILE_BASE_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

export function isProfileNotificationsPath(pathname = '') {
  return pathname.includes('/profile/notifications');
}

export function isProfileEditPath(pathname = '') {
  return pathname.endsWith('/profile/edit') || pathname.endsWith('/profile/edit/');
}
