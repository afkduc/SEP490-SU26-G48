import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, logoutApi } from '../services/authApi';
import { ROLES } from '../constants/roles';

const AppContext = createContext(null);

function loadSession() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (token && raw) {
      const user = JSON.parse(raw);
      // Load permissions từ localStorage (được set khi login)
      const permissions = localStorage.getItem('permissions') || sessionStorage.getItem('permissions');
      return {
        token,
        user,
        permissions: permissions ? JSON.parse(permissions) : (user.permissions || []),
      };
    }
  } catch {
    /* ignore */
  }
  return { token: null, user: null, permissions: [] };
}

function saveSession(token, user, permissions) {
  const storage = token === localStorage.getItem('token') ? localStorage : sessionStorage;
  storage.setItem('token', token);
  storage.setItem('user', JSON.stringify(user));
  storage.setItem('permissions', JSON.stringify(permissions || []));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('permissions');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('permissions');
}

/**
 * Chuyen roles ve dang array of string, ho tro ca 2 format:
 * - `['admin']` (string array)
 * - `[{ roleId: 1, roleName: 'admin' }]` (object array)
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => (typeof r === 'string' ? r : r?.roleName))
    .filter((name) => typeof name === 'string' && name.trim().length > 0);
}

/**
 * Tra ve path home phu hop nhat theo thu tu role (admin uu tien cao nhat)
 */
export function getRoleHome(user) {
  const roles = normalizeRoles(user?.roles);
  if (!roles.length) return '/dashboard';
  if (roles.includes(ROLES.ADMIN)) return '/admin/dashboard';
  if (roles.includes(ROLES.GENERAL_DIRECTOR)) return '/general-director';
  if (roles.includes(ROLES.MANAGER)) return '/manager';
  if (roles.includes(ROLES.WAREHOUSE_STAFF) || roles.includes(ROLES.ACCOUNTANT)) return '/inventory';
  return '/dashboard';
}

export function AppProvider({ children }) {
  const initial = loadSession();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [permissions, setPermissions] = useState(initial.permissions);

  useEffect(() => {
    if (token && user) {
      saveSession(token, user, permissions);
    }
  }, [token, user, permissions]);

  const login = async (email, password, remember = false) => {
    const result = await loginApi(email, password);
    const newPermissions = result.user?.permissions || [];
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', result.token);
    storage.setItem('user', JSON.stringify(result.user));
    storage.setItem('permissions', JSON.stringify(newPermissions));
    setToken(result.token);
    setUser(result.user);
    setPermissions(newPermissions);

    // Tra luon ket qua cho caller (LoginPage) de xu ly redirect neu can
    return result;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.warn('[AppContext] logout API failed (tiep tuc logout local):', e?.message);
    }
    clearSession();
    setToken(null);
    setUser(null);
    setPermissions([]);
  };

  /**
   * Reload permissions from localStorage.
   * Dùng sau khi admin thay đổi ma trận quyền trên chính máy của họ.
   */
  const reloadPermissions = () => {
    try {
      const stored = localStorage.getItem('permissions') || sessionStorage.getItem('permissions');
      if (stored) {
        setPermissions(JSON.parse(stored));
      }
    } catch {
      /* ignore */
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      permissions,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      reloadPermissions,
      setUser,
    }),
    [token, user, permissions]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAuth must be used within AppProvider');
  return ctx;
}

export function useAppContext() {
  return useAuth();
}

export default AppContext;
