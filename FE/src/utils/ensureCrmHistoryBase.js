import { BASE_PATH } from '../config';
import { toBrowserUrl } from './crmUrl';

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

function isCrmRootPath(pathname) {
  return CRM_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/**
 * Chặn History API ghi URL tuyệt đối thiếu basename /crm (production).
 * Cover: filter sync, nút tiến/lùi AdminLayout, sidebar, browser back/forward.
 */
export function ensureCrmHistoryBase() {
  if (!BASE_PATH || typeof window === 'undefined' || !window.history) return;

  const prefix = BASE_PATH;
  const origReplace = window.history.replaceState.bind(window.history);
  const origPush = window.history.pushState.bind(window.history);

  // Cho crmUrl.forceCrmBrowserUrl gọi native API, tránh đệ quy qua patch.
  window.__crmNativeReplaceState = origReplace;
  window.__crmNativePushState = origPush;

  const fixUrl = (url) => {
    if (url == null || typeof url !== 'string') return url;

    // React Router đôi khi chỉ truyền "?roleId=1" — resolve rồi gắn /crm.
    if (url.startsWith('?') || url.startsWith('#')) {
      let path = window.location.pathname || '/';
      if (!path.startsWith(prefix) && isCrmRootPath(path)) {
        path = `${prefix}${path}`;
      }
      if (url.startsWith('?')) return `${path}${url}`;
      return `${path}${window.location.search}${url}`;
    }

    if (!url.startsWith('/')) return url;
    return toBrowserUrl(url);
  };

  const repairCurrentUrl = () => {
    const { pathname, search, hash } = window.location;
    if (
      pathname.startsWith('/')
      && pathname !== prefix
      && !pathname.startsWith(`${prefix}/`)
      && !pathname.startsWith('/api')
      && isCrmRootPath(pathname)
    ) {
      origReplace(window.history.state, '', `${prefix}${pathname}${search}${hash}`);
    }
  };

  window.history.replaceState = (state, title, url) => {
    origReplace(state, title, url == null ? url : fixUrl(url));
  };
  window.history.pushState = (state, title, url) => {
    origPush(state, title, url == null ? url : fixUrl(url));
  };

  repairCurrentUrl();
  window.addEventListener('popstate', repairCurrentUrl);
}
