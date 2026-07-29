import { ROLE_PROFILE_CONFIG } from '../config/roleProfileConfig';

export const ROLE_PROFILE_BASE_PATHS = Object.freeze(
  Object.values(ROLE_PROFILE_CONFIG).map((cfg) => cfg.profilePath),
);

export function isRoleProfilePath(pathname = '') {
  return ROLE_PROFILE_BASE_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

export function isProfileNotificationsPath(pathname = '', search = '') {
  if (pathname.includes('/profile/notifications')) return true;
  const baseOk = pathname === '/admin/profile' || pathname.endsWith('/profile');
  if (!baseOk || pathname.endsWith('/edit')) return false;
  try {
    const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return q.get('tab') === 'notifications';
  } catch {
    return false;
  }
}

export function isProfileEditPath(pathname = '') {
  return pathname.endsWith('/profile/edit') || pathname.endsWith('/profile/edit/');
}
