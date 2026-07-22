import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, logoutApi } from '../services/authApi';
import { ROLES } from '../constants/roles';
import { useHeartbeat } from '../hooks/useHeartbeat';

const AppContext = createContext(null);

function loadSession() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const token = storage.getItem('token');
      const rawUser = storage.getItem('user');
      if (!token || !rawUser) continue;

      const user = JSON.parse(rawUser);
      const rawPermissions = storage.getItem('permissions');
      return {
        token,
        user,
        permissions: rawPermissions ? JSON.parse(rawPermissions) : (user.permissions || []),
      };
    } catch {
      // Thu storage con lai neu du lieu cua storage hien tai bi hong.
    }
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
  if (roles.includes(ROLES.TEAM_LEADER)) return '/repair-orders';
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

    // Chi giu mot phien luu tru. Neu token cu con o localStorage trong khi
    // login moi duoc luu vao sessionStorage, httpClient se uu tien token cu
    // va moi request sau login se bi 401 du login vua thanh cong.
    clearSession();
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

  // isAuthenticated tinh rieng de truyen xuong HeartbeatRunner
  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      token,
      user,
      permissions,
      isAuthenticated,
      login,
      logout,
      reloadPermissions,
      setUser,
    }),
    [token, user, permissions, isAuthenticated]
  );

  return (
    <AppContext.Provider value={value}>
      {/* HeartbeatRunner: goi POST /api/auth/heartbeat moi 60s de cap nhat
          last_activity_at phia BE. Tu dong tat khi user logout (enabled=false).
          Clock offset (server - client) cung duoc refresh moi 5 phut de cac
          trang admin hien thi thoi gian chinh xac. */}
      {isAuthenticated ? <HeartbeatRunner /> : null}
      {children}
    </AppContext.Provider>
  );
}

/**
 * Component con chi de goi useHeartbeat hook. React hooks khong the goi
 * truc tiep trong AppProvider (vi AppProvider la function component nhung
 * useHeartbeat can return state rieng - tach ra de clean code).
 */
function HeartbeatRunner() {
  useHeartbeat({ enabled: true });
  return null;
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
