import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { loginApi, logoutApi, getMeApi, getServerTime, getMyLoginChallengesApi } from '../services/authApi';
import { ROLES } from '../constants/roles';
import {
  ROLE_PROFILE_CONFIG,
  getProfileConfigByRole,
} from '../config/roleProfileConfig';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { usePermissionEventsSSE } from '../hooks/admin/usePermissionEventsSSE';
import { useNotifications } from '../hooks/useNotifications';
import { useToast } from '../components/common/ToastContext';
import { API_BASE_URL } from '../config';
import LoginChallengeModal from '../components/LoginChallengeModal';
import {
  resetSessionExpiredFlag,
  cancelAllPendingRequests,
  resetLoggedOutFlag,
  SESSION_LOGGED_OUT_EVENT,
  showSessionExpired,
} from '../services/httpClient';
import { mergeAuthRefreshUser } from '../utils/profileSession';

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
  localStorage.removeItem('auth_remember');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('permissions');
  sessionStorage.removeItem('auth_remember');
}

/**
 * Chuyen roles ve dang array of string, ho tro ca 2 format:
 * - `['admin']` (string array)
 * - `[{ roleId: 1, roleName: 'admin' }]` (object array)
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => {
      if (typeof r === 'string') return r;
      return r?.roleName || r?.name || null;
    })
    .filter((name) => typeof name === 'string' && name.trim().length > 0);
}

const ROLE_PRIORITY = [
  ROLES.ADMIN,
  ROLES.GENERAL_DIRECTOR,
  ROLES.MANAGER,
  ROLES.SERVICE_ADVISOR,
  ROLES.TEAM_LEADER,
  ROLES.TECHNICIAN,
  ROLES.WAREHOUSE_STAFF,
];

export function getPrimaryRole(user) {
  const roles = normalizeRoles(user?.roles);
  if (!roles.length) return user?.primaryRole || null;
  // Uu tien role cao nhat (admin > GD > manager > ...) de route/profile khong bi lech
  const prioritized = ROLE_PRIORITY.find((role) => roles.includes(role));
  if (prioritized) return prioritized;
  if (user?.primaryRole && roles.includes(user.primaryRole)) {
    return user.primaryRole;
  }
  return roles[0] || null;
}

/**
 * Tra ve path home phu hop nhat theo thu tu role (admin uu tien cao nhat)
 */
export function getRoleHome(user) {
  const role = getPrimaryRole(user);
  if (!role) return '/dashboard';
  if (role === ROLES.ADMIN) return '/admin/dashboard';
  if (role === ROLES.GENERAL_DIRECTOR) return '/general-director';
  if (role === ROLES.MANAGER) return '/manager';
  if (role === ROLES.SERVICE_ADVISOR) return '/dashboard';
  if (role === ROLES.TEAM_LEADER) return '/repair-orders';
  if (role === ROLES.TECHNICIAN) return '/repair-orders';
  if (role === ROLES.WAREHOUSE_STAFF) return '/inventory';
  return '/dashboard';
}

/**
 * Tra ve path ho so ca nhan theo role (moi role co URL rieng, khong dung /profile chung).
 */
export function getRoleProfilePath(user) {
  const role = getPrimaryRole(user);
  const cfg = getProfileConfigByRole(role);
  return cfg?.profilePath || ROLE_PROFILE_CONFIG[ROLES.SERVICE_ADVISOR].profilePath;
}

export function getRoleProfileEditPath(user) {
  const role = getPrimaryRole(user);
  const cfg = getProfileConfigByRole(role);
  return cfg?.profileEditPath || `${getRoleProfilePath(user)}/edit`;
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
        const fromStorage = newSession.user;
        if (!fromStorage) return currentUser;
        if (!currentUser) return fromStorage;
        return mergeAuthRefreshUser(fromStorage, currentUser);
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
          const incoming = e.data.user;
          if (!incoming) return currentUser;
          if (!currentUser) return incoming;
          return mergeAuthRefreshUser(currentUser, incoming);
        });
        setPermissions((currentPerms) => {
          if (JSON.stringify(e.data.permissions) !== JSON.stringify(currentPerms)) {
            return e.data.permissions || [];
          }
          return currentPerms;
        });
      }
    };

    // SESSION_LOGGED_OUT event: SessionExpiredModal hoac ForbiddenModal
    // clear localStorage khi user click "Dang nhap lai" -> phai clear luon
    // React state de LoginPage co the render form (khong bi redirect ve home).
    const handleSessionLoggedOut = () => {
      setToken(null);
      setUser(null);
      setPermissions([]);
    };

    window.addEventListener('storage', handleStorageChange);
    if (SESSION_CHANNEL) {
      SESSION_CHANNEL.addEventListener('message', handleBroadcast);
    }
    // SESSION_LOGGED_OUT: SessionExpiredModal hoac cac cho khac clear
    // localStorage khi user click "Dang nhap lai" -> clear luon React state.
    window.addEventListener(SESSION_LOGGED_OUT_EVENT, handleSessionLoggedOut);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (SESSION_CHANNEL) {
        SESSION_CHANNEL.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener(SESSION_LOGGED_OUT_EVENT, handleSessionLoggedOut);
    };
  }, []); // Run once on mount

  const login = useCallback(async (email, password, remember = false, branchId, options = {}) => {
    const result = await loginApi(email, password, branchId, {
      ...options,
      remember: Boolean(remember),
    });

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
    // Đánh dấu remember để các chỗ refresh token biết chọn storage / TTL.
    try {
      if (remember) localStorage.setItem('auth_remember', '1');
      else {
        localStorage.removeItem('auth_remember');
        sessionStorage.removeItem('auth_remember');
      }
    } catch {
      /* ignore */
    }

    // Reset anti-spam flag cua SessionExpiredModal (login moi = session moi).
    if (typeof resetSessionExpiredFlag === 'function') {
      resetSessionExpiredFlag();
    }
    // Reset "logged out" flag (login moi cho phep request moi duoc gui di).
    if (typeof resetLoggedOutFlag === 'function') {
      resetLoggedOutFlag();
    }

    // Full permissions (L1 + L2 flatten) cho UI ẩn/hiện nút.
    // JWT vẫn compact — không dùng JWT permissions làm nguồn chính cho FE.
    let newPermissions =
      (Array.isArray(result.effectivePermissions) && result.effectivePermissions) ||
      result.user?.permissions ||
      [];
    try {
      const me = await getMeApi();
      if (me && Array.isArray(me.permissions)) {
        newPermissions = me.permissions;
      }
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn('[AppContext] getMe after login failed, fallback to login perms:', e?.message);
      }
    }

    // Save permissions vao storage (token + user da save o tren)
    storage.setItem('permissions', JSON.stringify(newPermissions));

    // Cap nhat React state cuoi cung (re-render Provider)
    setToken(result.token);
    setUser(result.user);
    setPermissions(newPermissions);

    // Sync clockOffset (clockOffset = serverTime - clientTime) de cac
    // timestamp hien thi tren man login-history / devices luon khop voi
    // server (tranh sai lech do may client set sai gio he thong).
    try {
      const serverTimeRes = await getServerTime();
      if (serverTimeRes?.serverTime) {
        const serverMs = new Date(serverTimeRes.serverTime).getTime();
        const clientMs = Date.now();
        const offset = serverMs - clientMs;
        sessionStorage.setItem('clockOffset', String(offset));
        localStorage.setItem('clockOffset', String(offset));
      }
    } catch (e) {
      console.warn('[AppContext] sync clockOffset failed:', e?.message);
    }

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
    //
    // Bug cũ (2) - 401 storm khi logout:
    //   - Trước khi reload trang, có hàng chục request đang in-flight
    //     (heartbeat, SSE refresh, getMatrix, getBranches, getRoles...).
    //     Sau khi clearSession(), token = null, các request này hoàn tất và
    //     trả 401 trong console -> "Phiên đăng nhập đã hết hạn" nhảy lên.
    //   - Fix: gọi cancelAllPendingRequests() NGAY đầu hàm để:
    //     (a) abort tất cả request đang bay (fetch reject với AbortError,
    //         nuot o httpClient), và
    //     (b) set flag "logged out" để mọi request phát sinh SAU đó (queued
    //         setTimeout, effect chạy muộn, ...) đều bị abort trước khi tới
    //         server.
    try {
      cancelAllPendingRequests();
    } catch (e) {
      // Khong duoc de exception nay chan logout flow.
      if (typeof console !== 'undefined') {
        console.warn('[AppContext] cancelAllPendingRequests failed:', e?.message);
      }
    }

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

    // Reset anti-spam flag de lan sau login moi se reset (optional - flag tu reset sau 60s).
    if (typeof resetSessionExpiredFlag === 'function') {
      resetSessionExpiredFlag();
    }

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
      {isAuthenticated ? <PermissionEventsRunner /> : null}
      {isAuthenticated ? <SessionTakenOverRunner /> : null}
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
        matrix_updated: 'Quyền truy cập đã được cập nhật',
        role_screen_matrix_updated: 'Quyền truy cập đã được cập nhật',
        role_assigned: 'Bạn vừa được gán vai trò mới',
        role_revoked: 'Một vai trò của bạn đã bị thu hồi',
      };
      const label = actionLabels[event?.action] || 'Quyền của bạn đã được cập nhật';
      toast.info(label + '. Đang tải lại...', 4000);
    },
  });

  return null;
}

function LoginChallengeRunner() {
  const { token } = useAuth();
  // SSE notifications (bell + challenge event). Poll challenges làm backup nếu SSE trễ.
  useNotifications(token);
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    const onChallenge = (e) => {
      const detail = e?.detail;
      if (!detail?.pendingId) return;
      setChallenge((prev) => (prev?.pendingId === detail.pendingId ? prev : detail));
    };
    window.addEventListener('login-challenge', onChallenge);
    return () => window.removeEventListener('login-challenge', onChallenge);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getMyLoginChallengesApi();
        const items = data?.items || data || [];
        const first = Array.isArray(items) ? items[0] : null;
        if (cancelled || !first?.pendingId) return;
        const meta = first.clientMeta || {};
        setChallenge((prev) => {
          if (prev?.pendingId === first.pendingId) return prev;
          return {
            pendingId: first.pendingId,
            metadata: meta,
            device: [meta.browser, meta.os].filter(Boolean).join(' · ') || 'Thiết bị khác',
            ip: meta.ip,
            title: 'Yêu cầu đăng nhập mới',
            message: 'Có thiết bị khác đang cố đăng nhập tài khoản của bạn.',
          };
        });
      } catch {
        // ignore poll errors
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (!challenge) return null;
  return (
    <LoginChallengeModal
      challenge={challenge}
      onClose={() => setChallenge(null)}
    />
  );
}

/** Nghe SSE SESSION_TAKEN_OVER + giữ SSE notifications sống khi đã login. */
function SessionTakenOverRunner() {
  const { token } = useAuth();
  useNotifications(token);

  useEffect(() => {
    const onTakenOver = (e) => {
      const detail = e?.detail || {};
      const meta = detail?.metadata || {};
      // Bỏ qua nếu event dành cho phiên mới (chính tab vừa login)
      try {
        const t = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (t) {
          const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          const metaSessionId = meta.newSessionId != null ? Number(meta.newSessionId) : null;
          const metaVersion = meta.newTokenVersion != null ? Number(meta.newTokenVersion) : NaN;
          if (metaSessionId && Number(payload.sessionId) === metaSessionId) return;
          if (Number.isFinite(metaVersion) && Number(payload.tokenVersion) >= metaVersion) return;
        }
      } catch {
        // ignore parse errors — vẫn hiện modal an toàn cho phiên cũ
      }
      showSessionExpired({
        code: detail?.metadata?.code || detail?.code || 'SESSION_REPLACED',
        message: 'Đã có người đăng nhập tài khoản của bạn. Phiên hiện tại sẽ bị đăng xuất.',
      });
    };
    window.addEventListener('session-taken-over', onTakenOver);
    return () => window.removeEventListener('session-taken-over', onTakenOver);
  }, []);

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
