import { normalizeRoles, getPrimaryRole } from '../contexts/AppContext';

/**
 * Gop du lieu profile API vao user session (localStorage + AppContext).
 * Luu y: KHONG duoc lam mat roles/permissions — tranh ProtectedRoute redirect ve /dashboard.
 */
export function mergeProfileIntoSessionUser(existing = {}, profile = {}) {
  const existingRoles = normalizeRoles(existing?.roles);
  const profileRoles = normalizeRoles(profile?.roles);
  const roles = profileRoles.length > 0 ? profileRoles : existingRoles;

  const displayName =
    `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
    existing.name ||
    profile.userName ||
    existing.userName;

  const mergedForRole = { ...existing, roles };
  const primaryRole = getPrimaryRole(mergedForRole) || existing.primaryRole || null;

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
    primaryRole,
    primaryRoleLabel: existing.primaryRoleLabel ?? profile.primaryRoleLabel ?? null,
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

/**
 * Dong bo profile vao session — luon uu tien user tu React context lam nguon roles/permissions.
 */
export function syncProfileSession(currentUser, profileData, setUser) {
  const base = currentUser && typeof currentUser === 'object' ? currentUser : loadSessionUser();
  const updatedUser = mergeProfileIntoSessionUser(base, profileData);
  saveSessionUser(updatedUser);
  if (typeof setUser === 'function') {
    setUser(updatedUser);
  }
  return updatedUser;
}

/**
 * Merge auth refresh payload vao user hien tai (giu thong tin profile vua cap nhat).
 */
export function mergeAuthRefreshUser(existing = {}, refreshed = {}) {
  return mergeProfileIntoSessionUser(existing, {
    ...refreshed,
    roles: refreshed.roles ?? existing.roles,
    permissions: refreshed.permissions ?? existing.permissions,
    avatar: refreshed.avatar ?? existing.avatar,
    firstName: refreshed.firstName ?? existing.firstName,
    lastName: refreshed.lastName ?? existing.lastName,
    phone: refreshed.phone ?? existing.phone,
    email: refreshed.email ?? existing.email,
  });
}
