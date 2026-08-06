import { useCallback, useRef } from 'react';
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

/**
 * Ép thanh địa chỉ khớp path router + basename /crm.
 * Gọi sau navigate/setSearchParams để chặn bug mất /crm khi đổi filter.
 */
export function forceCrmBrowserUrl(routerPathname, search = '') {
  if (!BASE_PATH || typeof window === 'undefined') return;
  const qs = typeof search === 'string'
    ? (search.startsWith('?') || search === '' ? search : `?${search}`)
    : (search?.toString?.() ? `?${search.toString()}` : '');
  const expected = `${BASE_PATH}${routerPathname}${qs}`;
  const actual = `${window.location.pathname}${window.location.search}`;
  if (actual !== expected) {
    window.history.replaceState(window.history.state, '', expected);
  }
}

/**
 * Đồng bộ filter/query lên URL — giữ /crm trên production.
 * Thay cho setSearchParams khi sync list filter (role, ngày, search, ...).
 * nextParams: URLSearchParams | Record | (prev: URLSearchParams) => URLSearchParams
 *
 * Callback ổn định (không đổi theo location) để tránh loop trong useEffect.
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

    navigate({ pathname, search }, navigateOpts);
    forceCrmBrowserUrl(pathname, search);
  }, [navigate]);
}
