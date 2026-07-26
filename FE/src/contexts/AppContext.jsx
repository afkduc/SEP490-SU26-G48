import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { loginApi, logoutApi, getMeApi } from '../services/authApi';
import { ROLES } from '../constants/roles';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { usePermissionEventsSSE } from '../hooks/admin/usePermissionEventsSSE';
import { useToast } from '../components/common/ToastContext';
import { API_BASE_URL } from '../config';

const AppContext = createContext(null);

// BroadcastChannel for cross-tab session sync (works in same tab too)
const SESSION_CHANNEL = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('app-session') : null;

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

/**
 * Broadcast session change to other tabs via BroadcastChannel.
 * This fires immediately in ALL tabs (including sender).
 */
function broadcastSessionChange(session) {
  if (SESSION_CHANNEL) {
    SESSION_CHANNEL.postMessage(session);
  }
}

function saveSession(token, user, permissions) {
  // Xác định storage dựa trên token hiện tại trong từng storage
  const inLocal = localStorage.getItem('token');
  const inSession = sessionStorage.getItem('token');
  const storage = token === inLocal ? localStorage : (token === inSession ? sessionStorage : null);

  if (!storage) {
    // Fallback: nếu token không match cả 2 storage, bỏ qua (logout flow)
    return;
  }

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
      // Broadcast to other tabs immediately
      broadcastSessionChange({ token, user, permissions });
    }
  }, [token, user, permissions]);

  // Sync state when storage changes from another tab (cross-tab sync via storage event)
  // Plus listen to BroadcastChannel for same-tab sync
  useEffect(() => {
    const syncFromStorage = () => {
      const newSession = loadSession();
      // Only update if different from current state (prevent infinite loops)
      // Read current values directly from state via useState setter's functional update pattern
      setToken((currentToken) => {
        if (newSession.token !== currentToken) {
          return newSession.token;
        }
        return currentToken;
      });
      setUser((currentUser) => {
        if (newSession.user !== currentUser) {
          return newSession.user;
        }
        return currentUser;
      });
      setPermissions((currentPerms) => {
        if (JSON.stringify(newSession.permissions) !== JSON.stringify(currentPerms)) {
          return newSession.permissions;
        }
        return currentPerms;
      });
    };

    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user' || e.key === 'permissions') {
        syncFromStorage();
      }
    };

    const handleBroadcast = (e) => {
      if (e.data) {
        setToken((currentToken) => {
          if (e.data.token !== currentToken) {
            return e.data.token;
          }
          return currentToken;
        });
        setUser((currentUser) => {
          if (e.data.user !== currentUser) {
            return e.data.user;
          }
          return currentUser;
        });
        setPermissions((currentPerms) => {
          if (JSON.stringify(e.data.permissions) !== JSON.stringify(currentPerms)) {
            return e.data.permissions || [];
          }
          return currentPerms;
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    if (SESSION_CHANNEL) {
      SESSION_CHANNEL.addEventListener('message', handleBroadcast);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (SESSION_CHANNEL) {
        SESSION_CHANNEL.removeEventListener('message', handleBroadcast);
      }
    };
  }, []); // Run once on mount

  const login = useCallback(async (email, password, remember = false, branchId) => {
    const result = await loginApi(email, password, branchId);

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
  }, []);

  const logout = useCallback(async () => {
    // QUAN TRONG (sửa lỗi đồng bộ logout):
    //
    // Bug cũ:
    //   - clearSession() xoá localStorage → httpClient đọc token = null
    //   - window.location.assign('/login') chuyển trang TRƯỚC khi BE trackLogout
    //     kịp cập nhật login_sessions (status='ended')
    //   - Kết quả: FE nghĩ đã logout, nhưng DB vẫn 'active' → trang "Lịch sử
    //     đăng nhập" của admin hiển thị phiên cũ là "Đang hoạt động".
    //
    // Fix:
    //   1. Dùng `fetch` keepalive:true để request logout bay tới BE dù page
    //      navigate. keepalive cho phép browser giữ request tối đa ~64KB
    //      và fire-and-forget ngay cả khi tab đã đóng.
    //   2. Lưu token TRƯỚC khi clearSession() để request keepalive vẫn có
    //      Authorization header hợp lệ.
    //   3. Bỏ qua UI loading - ưu tiên tốc độ chuyển trang.
    try {
      const tokenNow = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (tokenNow) {
        // fetch keepalive KHÔNG await - fire-and-forget. Browser sẽ đảm bảo
        // request được gửi dù page reload/navigate ngay sau đó.
        fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenNow}`,
          },
          body: JSON.stringify({}),
          keepalive: true, // ← critical: cho phép request sống qua page navigation
        }).catch((err) => {
          if (typeof console !== 'undefined') {
            console.warn('[AppContext] logout keepalive fetch failed:', err?.message);
          }
        });
      }
    } catch (e) {
      // keepalive throw có thể do tokenNow undefined - bo qua
    }

    clearSession();
    setToken(null);
    setUser(null);
    setPermissions([]);

    // FORCE RELOAD: dam bao 100% da user ra khoi trang admin, khong con
    // bat ky React state nao giu token/user cu. Mot so truong hop (HMR,
    // strict mode double-effect, navigate bi block) khong clear duoc state
    // -> user van thay trang admin. Reload toan trang la cach an toan nhat.
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign('/login');
    }
  }, []);

  const reloadPermissions = useCallback(() => {
    try {
      const stored = localStorage.getItem('permissions') || sessionStorage.getItem('permissions');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPermissions(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      token,
      user,
      permissions,
      isAuthenticated,
      authReady,
      login,
      logout,
      reloadPermissions,
      setUser,
      setPermissions,
    }),
    [token, user, permissions, isAuthenticated, authReady, login, logout, reloadPermissions]
  );

  return (
    <AppContext.Provider value={value}>
      {/* HeartbeatRunner: goi POST /api/auth/heartbeat moi 60s.
          Tu tat khi user logout. Tu backoff khi nhan 401 de tranh spam. */}
      {isAuthenticated ? <HeartbeatRunner /> : null}
      {/* PermissionEventsRunner: SSE listener de refresh quyen realtime khi admin
          thay doi ma tran quyen / gan role / revoke role. Tu tat khi logout. */}
      {isAuthenticated ? <PermissionEventsRunner /> : null}
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

/**
 * PermissionEventsRunner: lang nghe SSE /api/sse/permissions.
 *
 * Khi nhan event 'permission-changed' (admin vua thay doi permission cua
 * user hien tai), hook se:
 *   1. POST /api/auth/refresh-permissions de lay token moi
 *   2. Save token + permissions moi vao localStorage (storage-first pattern)
 *   3. Hien toast "Quyen cua ban vua duoc cap nhat"
 *   4. React PermissionGate se re-render do storage event -> AppContext state update
 *
 * LUU Y: hook usePermissionEventsSSE da tu luu vao storage va dispatch
 * 'storage' event -> AppContext state setter se tu dong duoc goi qua
 * listener o useEffect ben tren. Khong can setState thu cong o day.
 */
function PermissionEventsRunner() {
  const { token } = useAuth();
  const toast = useToast();

  usePermissionEventsSSE({
    enabled: true,
    token,
    onPermissionChanged: (event) => {
      // Toast thong bao cho user biet quyen vua duoc cap nhat.
      // action: 'matrix_updated' | 'role_assigned' | 'role_revoked'
      const actionLabels = {
        matrix_updated: 'Ma trận quyền đã được cập nhật',
        role_assigned: 'Bạn vừa được gán vai trò mới',
        role_revoked: 'Một vai trò của bạn đã bị thu hồi',
      };
      const label = actionLabels[event?.action] || 'Quyền của bạn đã được cập nhật';
      toast.info(label + '. Đang tải lại...', 4000);
    },
  });

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
