import { normalizeRoles } from '../contexts/AppContext';

/**
 * Gop du lieu profile API vao user session (localStorage + AppContext).
 * Giu permissions/primaryRole va chuan hoa roles ve dang string[] nhu login.
 */
export function mergeProfileIntoSessionUser(existing = {}, profile = {}) {
  const profileRoles = normalizeRoles(profile.roles);
  const existingRoles = normalizeRoles(existing.roles);
  const roles = profileRoles.length ? profileRoles : existingRoles;

  const displayName =
    `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
    existing.name ||
    profile.userName ||
    existing.userName;

  return {
    ...existing,
    id: profile.id ?? profile.userId ?? existing.id,
    email: profile.email ?? existing.email,
    userName: profile.userName || existing.userName || profile.email || existing.email,
    name: displayName,
    firstName: profile.firstName ?? existing.firstName,
    lastName: profile.lastName ?? existing.lastName,
    phone: profile.phone ?? existing.phone,
    avatar: profile.avatar ?? existing.avatar,
    branchId: profile.branchId ?? existing.branchId,
    branchName: profile.branchName ?? existing.branchName,
    roles,
    permissions: profile.permissions ?? existing.permissions,
    primaryRole: existing.primaryRole && roles.includes(existing.primaryRole)
      ? existing.primaryRole
      : roles[0] || existing.primaryRole || null,
    primaryRoleLabel: existing.primaryRoleLabel ?? null,
  };
}

export function loadSessionUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSessionUser(updatedUser) {
  const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
  storage.setItem('user', JSON.stringify(updatedUser));
  return storage;
}
