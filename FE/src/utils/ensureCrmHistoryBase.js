import { getCrmPrefix } from '../config';
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
 * Patch History API + sửa URL thiếu /crm.
 * Dùng getCrmPrefix() runtime — không phụ thuộc BASE_PATH lúc import.
 */
export function ensureCrmHistoryBase() {
  if (typeof window === 'undefined' || !window.history) return;

  const origReplace = window.history.replaceState.bind(window.history);
  const origPush = window.history.pushState.bind(window.history);

  window.__crmNativeReplaceState = origReplace;
  window.__crmNativePushState = origPush;

  const fixUrl = (url) => {
    if (url == null || typeof url !== 'string') return url;
    const prefix = getCrmPrefix();
    if (!prefix) return url;

    // Absolute same-origin URL → chuẩn hóa pathname có /crm
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const u = new URL(url);
        if (u.origin !== window.location.origin) return url;
        return toBrowserUrl(`${u.pathname}${u.search}${u.hash}`);
      } catch {
        return url;
      }
    }

    // Chỉ query/hash — luôn gắn vào /crm + path hiện tại
    if (url.startsWith('?') || url.startsWith('#')) {
      let path = window.location.pathname || '/';
      if (path.startsWith(`${prefix}/`) || path === prefix) {
        // đã đúng
      } else if (isCrmRootPath(path)) {
        path = `${prefix}${path}`;
      } else {
        // fallback: giữ path, vẫn cố gắn prefix nếu thiếu
        path = toBrowserUrl(path);
      }
      if (url.startsWith('?')) return `${path}${url}`;
      return `${path}${window.location.search}${url}`;
    }

    if (!url.startsWith('/')) return url;
    // /admin/users?roleId=1 → /crm/admin/users?roleId=1
    return toBrowserUrl(url);
  };

  const repairCurrentUrl = () => {
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

  // Watchdog: nếu filter/navigate làm mất /crm, sửa trong vòng ~300ms
  if (!window.__crmUrlWatchdog) {
    window.__crmUrlWatchdog = window.setInterval(repairCurrentUrl, 300);
  }
}
