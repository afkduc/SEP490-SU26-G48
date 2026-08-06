import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BASE_PATH } from '../config';

function getNativeReplaceState() {
  if (typeof window === 'undefined') return null;
  return window.__crmNativeReplaceState
    || window.history.replaceState.bind(window.history);
}

/**
 * Path của React Router (vd /admin/users?roleId=1) → URL trình duyệt có /crm.
 */
export function toBrowserUrl(routerPathAndSearch = '') {
  const path = routerPathAndSearch.startsWith('/')
    ? routerPathAndSearch
    : `/${routerPathAndSearch}`;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/** Bỏ prefix /crm nếu path lỡ chứa basename (tránh double /crm/crm). */
export function stripCrmBase(pathname = '/') {
  if (!BASE_PATH) return pathname || '/';
  if (pathname === BASE_PATH) return '/';
  if (pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length) || '/';
  return pathname || '/';
}

export function parseRouterUrl(to) {
  if (to && typeof to === 'object') {
    return {
      pathname: stripCrmBase(to.pathname || '/'),
      search: to.search || '',
      hash: to.hash || '',
    };
  }
  const raw = String(to || '/');
  const hashIdx = raw.indexOf('#');
  const withoutHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : '';
  const qIdx = withoutHash.indexOf('?');
  const pathname = stripCrmBase(qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash);
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : '';
  return { pathname, search, hash };
}

function buildExpectedUrl(routerPathname, search = '', hash = '') {
  const pathname = stripCrmBase(routerPathname || '/');
  const qs = typeof search === 'string'
    ? (search.startsWith('?') || search === '' ? search : `?${search}`)
    : (search?.toString?.() ? `?${search.toString()}` : '');
  const hashPart = !hash
    ? ''
    : (hash.startsWith('#') ? hash : `#${hash}`);
  if (!BASE_PATH) return `${pathname}${qs}${hashPart}`;
  return `${BASE_PATH}${pathname}${qs}${hashPart}`;
}

/**
 * Ép thanh địa chỉ khớp path router + basename /crm.
 * Dùng native replaceState (không qua patch) + microtask/rAF để thắng race với React Router.
 */
export function forceCrmBrowserUrl(routerPathname, search = '', hash = '') {
  if (!BASE_PATH || typeof window === 'undefined') return;
  const expected = buildExpectedUrl(routerPathname, search, hash);
  const apply = () => {
    const actual = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (actual !== expected) {
      const nativeReplace = getNativeReplaceState();
      nativeReplace(window.history.state, '', expected);
    }
  };
  apply();
  queueMicrotask(apply);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply);
  }
}

/**
 * navigate an toàn trên production: luôn ép URL trình duyệt có /crm sau khi đổi route.
 */
export function navigateWithCrm(navigate, to, opts) {
  const loc = parseRouterUrl(to);
  navigate(
    { pathname: loc.pathname, search: loc.search, hash: loc.hash },
    opts,
  );
  forceCrmBrowserUrl(loc.pathname, loc.search, loc.hash);
}

/**
 * Mount trong BrowserRouter — mọi lần đổi route đều ép lại /crm trên thanh địa chỉ.
 */
export function CrmUrlGuard() {
  const location = useLocation();

  useEffect(() => {
    forceCrmBrowserUrl(location.pathname, location.search, location.hash);
  }, [location.pathname, location.search, location.hash]);

  return null;
}

/**
 * Đồng bộ filter/query lên URL — giữ /crm trên production.
 * Ghi URL bằng native history TRƯỚC, rồi sync React Router, rồi ép lại /crm.
 */
export function useCrmSearchSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  return useCallback((nextParams, navigateOpts = { replace: true }) => {
    const { pathname, search: currentSearch } = locationRef.current;
    const current = new URLSearchParams(currentSearch);
    const resolved = typeof nextParams === 'function' ? nextParams(current) : nextParams;
    const sp = resolved instanceof URLSearchParams
      ? resolved
      : new URLSearchParams(resolved || {});
    const qs = sp.toString();
    const search = qs ? `?${qs}` : '';

    // 1) Ghi thẳng URL trình duyệt có /crm (tránh setSearchParams/navigate làm mất basename)
    const nativeReplace = getNativeReplaceState();
    if (BASE_PATH && nativeReplace) {
      nativeReplace(window.history.state, '', buildExpectedUrl(pathname, search));
    }

    // 2) Sync state React Router
    navigate({ pathname, search }, navigateOpts);

    // 3) Ép lại nếu RR ghi đè thiếu /crm
    forceCrmBrowserUrl(pathname, search);
  }, [navigate]);
}
