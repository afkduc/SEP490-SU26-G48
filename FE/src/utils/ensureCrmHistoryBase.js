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

  const fixUrl = (url) => {
    if (url == null || typeof url !== 'string' || !url.startsWith('/')) return url;
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
