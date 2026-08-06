import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BASE_PATH } from '../config';

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

/**
 * Ép thanh địa chỉ khớp path router + basename /crm.
 */
export function forceCrmBrowserUrl(routerPathname, search = '', hash = '') {
  if (!BASE_PATH || typeof window === 'undefined') return;
  const pathname = stripCrmBase(routerPathname || '/');
  const qs = typeof search === 'string'
    ? (search.startsWith('?') || search === '' ? search : `?${search}`)
    : (search?.toString?.() ? `?${search.toString()}` : '');
  const hashPart = !hash
    ? ''
    : (hash.startsWith('#') ? hash : `#${hash}`);
  const expected = `${BASE_PATH}${pathname}${qs}${hashPart}`;
  const actual = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (actual !== expected) {
    window.history.replaceState(window.history.state, '', expected);
  }
}

/**
 * navigate an toàn trên production: luôn ép URL trình duyệt có /crm sau khi đổi route.
 * Dùng cho AdminLayout tiến/lùi và mọi chỗ navigate bằng string path.
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
 * Chặn filter sync, nút tiến/lùi, sidebar, deep-link… mất basename.
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
 * nextParams: URLSearchParams | Record | (prev: URLSearchParams) => URLSearchParams
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

    navigateWithCrm(navigate, { pathname, search }, navigateOpts);
  }, [navigate]);
}
