import { API_BASE_URL } from '../config';

export const SESSION_EXPIRED_KEY = 'SESSION_EXPIRED';
export const FORBIDDEN_KEY = 'FORBIDDEN_DENIED';
export const LOGOUT_KEY = 'app:logout';
// Event danh dau: "Da clear localStorage, AppContext phai clear React state".
// Khi user click "Dang nhap lai" tu SessionExpiredModal hoac ForbiddenModal,
// localStorage + sessionStorage bi clear. AppContext lang nghe event nay de
// clear token/user/permissions trong React state. Neu khong clear state,
// isAuthenticated van true -> LoginPage useEffect redirect ve home ngay
// khi vua navigate xong -> user khong the dang nhap lai.
export const SESSION_LOGGED_OUT_EVENT = 'SESSION_LOGGED_OUT';

// Flag toan cuc de chong spam SessionExpiredModal.
// Set true khi modal hien, reset khi user login thanh cong (login flow se
// thay doi token -> reset flag) hoac khi logout xoa storage.
// Dam bao chi FIRE 1 modal du co hang loat request 401 cung luc.
let sessionExpiredDispatchedRef = false;

// Track all in-flight requests so we can abort them on logout.
// Map<symbol, AbortController>
const pendingControllers = new Map();

/**
 * Module-level flag indicating the user has logged out (or session was cleared).
 * Any request initiated AFTER this flag is set will be aborted immediately
 * instead of being sent to the server. This prevents the flood of 401s that
 * happens when in-flight requests from before logout complete without a token.
 */
let loggedOutFlag = false;

/**
 * Module-level flag to skip the next incoming SSE permission-changed event
 * from triggering an automatic refresh-permissions call.
 *
 * Use case: when admin saves the permission matrix themselves, the BE
 * broadcasts `permission-changed`. The admin's own React state already
 * reflects the new permissions (just-and-saved), so auto-refreshing the JWT
 * would be redundant and could trigger a 403 storm on the next in-flight
 * request using the now-stale JWT (race condition between SSE save event
 * and the next request that already captured the old token).
 *
 * Set this flag from the page that just saved the matrix. The SSE hook
 * checks it once and resets the flag.
 */
let skipNextPermissionChangeRef = false;

/**
 * Mark the next 'permission-changed' SSE event as self-initiated, so the
 * SSE hook will NOT trigger an automatic refresh-permissions call.
 *
 * Should be called by the page that just saved the permission matrix,
 * BEFORE the BE has time to broadcast the SSE event (typically right after
 * the save API returns 200).
 */
export function markNextPermissionChangeAsSelf() {
  skipNextPermissionChangeRef = true;
}

/**
 * Internal: check & consume the skip flag. Returns true if the next event
 * should be skipped.
 */
export function consumeSkipNextPermissionChange() {
  if (skipNextPermissionChangeRef) {
    skipNextPermissionChangeRef = false;
    return true;
  }
  return false;
}

/**
 * Reset the "logged out" flag. Call this on successful login so subsequent
 * requests are allowed again.
 */
export function resetLoggedOutFlag() {
  loggedOutFlag = false;
}

/**
 * Mark the user as logged out AND cancel all in-flight requests. Any request
 * that is mid-flight will be aborted (browser will fire AbortError, which we
 * swallow to avoid console errors). Any new request fired after this point
 * (e.g. a queued setTimeout tick) will be aborted before going to the wire.
 *
 * Side effects:
 *  - Aborts every AbortController we handed out from this module
 *  - Sets a flag that makes future request() calls no-op (return a rejected
 *    promise with a tagged error so callers can silently bail)
 *  - Dispatches a window event so other listeners (SSE, heartbeat) can
 *    close their connections / cancel their timers
 */
export function cancelAllPendingRequests() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOGOUT_KEY));
  }
  loggedOutFlag = true;
  for (const [, controller] of pendingControllers) {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  }
  pendingControllers.clear();
}

export function showSessionExpired(detail = {}) {
  // Bo qua neu user da o trang login (modal khong can hien).
  if (typeof window !== 'undefined' && window.location.pathname === '/login') {
    return;
  }
  // Bo qua neu modal da duoc dispatch trong vong 1 phut (tranh spam tu nhieu
  // request 401 dong thoi).
  if (sessionExpiredDispatchedRef) {
    return;
  }
  sessionExpiredDispatchedRef = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_KEY, { detail: detail || {} }));

  // Reset sau 60s de phong tru hop user dong modal nhung khong logout,
  // lan sau gap 401 se hien lai modal.
  setTimeout(() => {
    sessionExpiredDispatchedRef = false;
  }, 60_000);
}

/**
 * Reset anti-spam flag khi user login thanh cong (token moi -> session moi).
 * Goi ham nay tu login handler sau khi setItem('token', ...).
 */
export function resetSessionExpiredFlag() {
  sessionExpiredDispatchedRef = false;
}

/**
 * Dispatch khi API tra 403 Forbidden.
 * - permissionKey (optional): permission bi thieu (BE tra trong payload.metadata)
 * - message: thong bao tu BE
 * - path/to: url dang goi (debug)
 */
export function showForbidden({ permissionKey = null, message = '', path = '' } = {}) {
  window.dispatchEvent(new CustomEvent(FORBIDDEN_KEY, {
    detail: { permissionKey, message, path },
  }));
}

class HttpClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(path, {
    method = 'GET',
    body,
    headers = {},
    isForm = false,
    omitAuth = false,
    skipSessionExpired = false,
    signal: externalSignal = null,
  } = {}) {
    // If logout has fired, refuse to make new requests. We surface a tagged
    // AbortError so callers can detect and bail without spamming the console.
    if (loggedOutFlag) {
      const err = new Error('Request aborted: user logged out');
      err.name = 'AbortError';
      err.code = 'LOGGED_OUT';
      throw err;
    }

    const token = omitAuth
      ? null
      : localStorage.getItem('token') || sessionStorage.getItem('token');

    // Use a controller so we can cancel from cancelAllPendingRequests().
    // If caller passed their own signal (e.g. SSE refresh), chain it.
    const controller = new AbortController();
    const trackId = Symbol('http');
    pendingControllers.set(trackId, controller);
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort);
    }

    let response;
    try {
      response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          ...(isForm ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      // Always clean up before re-throwing
      pendingControllers.delete(trackId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      if (err && (err.name === 'AbortError' || err.code === 'LOGGED_OUT')) {
        // Re-throw as a tagged error so callers (and console) can distinguish
        // a "we cancelled it on logout" from a real network error.
        const out = new Error('Request aborted');
        out.name = 'AbortError';
        out.code = 'ABORTED';
        throw out;
      }
      throw err;
    }
    pendingControllers.delete(trackId);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const belongsToCurrentSession = Boolean(token && token === currentToken);

      // 403 = da dang nhap nhung khong du quyen.
      // -> dispatch FORBIDDEN_KEY de FE show trang 403 (toan man hinh).
      // Anti-spam: chi dispatch khi thuoc session hien tai (tranh stale request
      // cua user da logout).
      if (response.status === 403 && belongsToCurrentSession) {
        const required = Array.isArray(payload?.required) ? payload.required : [];
        const permissionKey =
          payload?.metadata?.permissionKey
          || payload?.permissionKey
          || required[0]
          || null;
        showForbidden({
          permissionKey,
          message: (payload && payload.message) || 'Bạn không có quyền thực hiện thao tác này',
          path,
        });
      }

      if (response.status === 401 && belongsToCurrentSession && !skipSessionExpired) {
        showSessionExpired({
          code: payload?.code || null,
          message: (payload && payload.message) || '',
        });
      }
      const message = (payload && payload.message) || response.statusText;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.code = payload?.code || null;
      error.details = payload?.details || null;
      // Attach permissionKey from response metadata if present
      if (response.status === 403) {
        const required = Array.isArray(payload?.required) ? payload.required : [];
        error.permissionKey =
          payload?.metadata?.permissionKey
          || payload?.permissionKey
          || required[0]
          || null;
      }
      throw error;
    }

    // BE wraps all responses in { success, message, data }
    // Unwrap to return just the data so callers don't need .data everywhere
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  get(path, options = {}) {
    return this.request(path, { method: 'GET', ...options });
  }

  post(path, body, options = {}) {
    return this.request(path, { method: 'POST', body, ...options });
  }

  postForm(path, formData, options = {}) {
    return this.request(path, { method: 'POST', body: formData, isForm: true, ...options });
  }

  put(path, body, options = {}) {
    return this.request(path, { method: 'PUT', body, ...options });
  }

  patch(path, body, options = {}) {
    return this.request(path, { method: 'PATCH', body, ...options });
  }

  delete(path, options = {}) {
    return this.request(path, { method: 'DELETE', ...options });
  }
}

const httpClient = new HttpClient();

export default httpClient;
export { HttpClient };
