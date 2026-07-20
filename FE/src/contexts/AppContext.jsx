import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, logoutApi, getMeApi } from '../services/authApi';
import { ROLES } from '../constants/roles';
import { useHeartbeat } from '../hooks/useHeartbeat';

const AppContext = createContext(null);

/**
 * Load session một cách đồng bộ. Hàm này được gọi TRƯỚC khi Provider
 * mount children nên không có race condition — đảm bảo lần render đầu
 * tiên đã có token/user/permissions (không phải đợi useEffect chạy).
 */
function loadSession() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const token = storage.getItem('token');
      const rawUser = storage.getItem('user');
      // Chi load khi CA token va user deu co (tranh re-render 2 lan)
      if (!token || !rawUser) continue;

      const user = JSON.parse(rawUser);
      const rawPermissions = storage.getItem('permissions');
      const permissions = rawPermissions
        ? JSON.parse(rawPermissions)
        : (user.permissions || []);
      return { token, user, permissions };
    } catch {
      // Bo qua storage loi, thu storage con lai.
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
  if (roles.includes(ROLES.WAREHOUSE_STAFF) || roles.includes(ROLES.ACCOUNTANT)) return '/inventory';
  return '/dashboard';
}

export function AppProvider({ children }) {
  // QUAN TRONG: load session DONG BO truoc khi tao state.
  // Tranh duoc tinh trang "render lan dau khong co permission" ->
  // "PermissionGate an het button" -> phai F5 moi thay.
  const initial = loadSession();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [permissions, setPermissions] = useState(initial.permissions);

  // Phân biệt "session đã hydrate xong" với "không có session".
  // Hydrated = true ngay khi component mount (initial đã load ở trên).
  // Neu khong co session, van hydrate xong (chi la khong co gi).
  // Muc dich: cac component con co the phan biet "dang load" vs "da load xong, khong co data".
  const [authReady] = useState(true);

  // Dong bo session vao storage khi state thay doi (sau login/logout)
  useEffect(() => {
    if (token && user) {
      saveSession(token, user, permissions);
    }
  }, [token, user, permissions]);

  const login = async (email, password, remember = false) => {
    const result = await loginApi(email, password);

    // QUAN TRONG: Phai save token vao storage TRUOC khi goi bat ky
    // authenticated API nao (nhu getMeApi). Vi httpClient luon doc token
    // tu storage (khong phai tu React state), neu khong save truoc se
    // gay 401 "Chua dang nhap" ngay sau login -> phai F5 moi het loi.
    //
    // Thu tu DONG BO (khong qua useEffect):
    //   1. clearSession()      -> xoa token cu (neu co)
    //   2. setItem('token')    -> save token moi VAO STORAGE truoc
    //   3. getMeApi()          -> call API co Authorization header moi
    //   4. setItem('permissions') -> save permissions sau khi co
    //   5. setState()          -> cap nhat React state cuoi cung
    clearSession();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', result.token);
    storage.setItem('user', JSON.stringify(result.user));

    // Lay quyen moi nhat tu server (permissions trong JWT co the STALE neu
    // admin vua thay doi ma tran quyen o mot tab khac). Fallback ve
    // permissions tu JWT neu API fail (mang chap / 401).
    let newPermissions = result.user?.permissions || [];
    try {
      const me = await getMeApi();
      if (me && Array.isArray(me.permissions)) {
        newPermissions = me.permissions;
      }
    } catch (e) {
      // Nuot loi — permissions tu JWT van OK cho lan render dau tien.
      if (typeof console !== 'undefined') {
        console.warn('[AppContext] getMe after login failed, fallback to JWT perms:', e?.message);
      }
    }

    // Save permissions vao storage (token + user da save o tren)
    storage.setItem('permissions', JSON.stringify(newPermissions));

    // Cap nhat React state cuoi cung (re-render Provider)
    setToken(result.token);
    setUser(result.user);
    setPermissions(newPermissions);

    return result;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      // Logout API fail khong quan trong — ta van don dep local.
      if (typeof console !== 'undefined') {
        console.warn('[AppContext] logout API failed (tiep tuc logout local):', e?.message);
      }
    }
    clearSession();
    setToken(null);
    setUser(null);
    setPermissions([]);
  };

  /**
   * Reload permissions from localStorage.
   * Dung sau khi admin thay doi ma tran quyen tren chinh may cua ho.
   */
  const reloadPermissions = () => {
    try {
      const stored = localStorage.getItem('permissions') || sessionStorage.getItem('permissions');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPermissions(parsed);
      }
    } catch {
      /* ignore */
    }
  };

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      token,
      user,
      permissions,
      isAuthenticated,
      // Flag bao cho cac component con biet rang session da hydrate
      // xong (khoi can loading spinner cho AuthContext).
      authReady,
      login,
      logout,
      reloadPermissions,
      setUser,
      setPermissions,
    }),
    [token, user, permissions, isAuthenticated, authReady]
  );

  return (
    <AppContext.Provider value={value}>
      {/* HeartbeatRunner: goi POST /api/auth/heartbeat moi 60s.
          Tu tat khi user logout. Tu backoff khi nhan 401 de tranh spam. */}
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
