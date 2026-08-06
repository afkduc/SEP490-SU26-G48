import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BASE_PATH, getCrmPrefix } from '../config';

const CRM_ROOTS = [
  '/admin',
  '/login',
  '/unauthorized',
  '/manager',
  '/inventory',
  '/repair',
  '/technician',
  '/customer',
  '/profile',
  '/team-leader',
  '/warehouse',
  '/cashier',
  '/receptionist',
];

function getNativeReplaceState() {
  if (typeof window === 'undefined') return null;
  return window.__crmNativeReplaceState
    || window.history.replaceState.bind(window.history);
}

function isCrmRootPath(pathname) {
  return CRM_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/**
 * Path router → URL trình duyệt có /crm (dùng prefix runtime).
 */
export function toBrowserUrl(routerPathAndSearch = '') {
  const prefix = getCrmPrefix();
  const path = routerPathAndSearch.startsWith('/')
    ? routerPathAndSearch
    : `/${routerPathAndSearch}`;
  if (!prefix) return path;
  if (path === prefix || path.startsWith(`${prefix}/`)) return path;
  return `${prefix}${path}`;
}

export function stripCrmBase(pathname = '/') {
  const prefix = getCrmPrefix() || BASE_PATH;
  if (!prefix) return pathname || '/';
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || '/';
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
  const prefix = getCrmPrefix();
  const pathname = stripCrmBase(routerPathname || '/');
  const qs = typeof search === 'string'
    ? (search.startsWith('?') || search === '' ? search : `?${search}`)
    : (search?.toString?.() ? `?${search.toString()}` : '');
  const hashPart = !hash
    ? ''
    : (hash.startsWith('#') ? hash : `#${hash}`);
  if (!prefix) return `${pathname}${qs}${hashPart}`;
  return `${prefix}${pathname}${qs}${hashPart}`;
}

/**
 * Ép thanh địa chỉ có /crm. Gọi sau mọi lần đổi filter/route.
 */
export function forceCrmBrowserUrl(routerPathname, search = '', hash = '') {
  if (typeof window === 'undefined') return;
  const prefix = getCrmPrefix();
  if (!prefix) return;

  const expected = buildExpectedUrl(routerPathname, search, hash);
  const apply = () => {
    const actual = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (actual === expected) return;
    const nativeReplace = getNativeReplaceState();
    if (!nativeReplace) return;
    nativeReplace(window.history.state, '', expected);
  };

  apply();
  queueMicrotask(apply);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply);
  }
  // Thêm 1 nhịp muộn — thắng race với React Router ghi đè thiếu /crm
  setTimeout(apply, 0);
  setTimeout(apply, 50);
}

/**
 * Nếu thanh địa chỉ đang ở /admin/... (thiếu /crm) thì chèn lại /crm.
 * Dùng cho watchdog + sau filter.
 */
export function repairMissingCrmPrefix() {
  if (typeof window === 'undefined') return;
  const prefix = getCrmPrefix();
  if (!prefix) return;

  const { pathname, search, hash } = window.location;
  if (
    pathname.startsWith('/')
    && pathname !== prefix
    && !pathname.startsWith(`${prefix}/`)
    && !pathname.startsWith('/api')
    && isCrmRootPath(pathname)
  ) {
    const nativeReplace = getNativeReplaceState();
    if (!nativeReplace) return;
    nativeReplace(window.history.state, '', `${prefix}${pathname}${search}${hash}`);
  }
}

export function navigateWithCrm(navigate, to, opts) {
  const loc = parseRouterUrl(to);
  navigate(
    { pathname: loc.pathname, search: loc.search, hash: loc.hash },
    opts,
  );
  forceCrmBrowserUrl(loc.pathname, loc.search, loc.hash);
}

/**
 * Ép /crm mỗi lần location đổi + watchdog định kỳ (chặn filter làm mất /crm).
 */
export function CrmUrlGuard() {
  const location = useLocation();

  useEffect(() => {
    forceCrmBrowserUrl(location.pathname, location.search, location.hash);
    repairMissingCrmPrefix();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const id = window.setInterval(() => {
      repairMissingCrmPrefix();
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  return null;
}

/**
 * Đồng bộ filter → URL. Luôn ghi /crm trước/sau navigate.
 */
export function useCrmSearchSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  return useCallback((nextParams, navigateOpts = { replace: true }) => {
    const { pathname } = locationRef.current;
    const current = new URLSearchParams(locationRef.current.search);
    const resolved = typeof nextParams === 'function' ? nextParams(current) : nextParams;
    const sp = resolved instanceof URLSearchParams
      ? resolved
      : new URLSearchParams(resolved || {});
    const qs = sp.toString();
    const search = qs ? `?${qs}` : '';
    const expected = buildExpectedUrl(pathname, search);
    const nativeReplace = getNativeReplaceState();

    // 1) Ghi URL đầy đủ /crm NGAY (không chờ React Router)
    if (nativeReplace) {
      nativeReplace(window.history.state, '', expected);
    }

    // 2) Sync React Router
    navigate({ pathname, search }, navigateOpts);

    // 3) Ép lại nhiều nhịp — RR thường ghi đè thiếu /crm ngay sau navigate
    forceCrmBrowserUrl(pathname, search);
    repairMissingCrmPrefix();
  }, [navigate]);
}
