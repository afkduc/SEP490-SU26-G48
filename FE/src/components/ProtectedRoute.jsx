import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { usePermission } from '../contexts';
import { getRoleHome, normalizeRoles } from '../contexts/AppContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { useEffect, useRef } from 'react';
import { mergeAuthRefreshUser } from '../utils/profileSession';
import { refreshPermissionsApi } from '../services/authApi';
import { getPermissionScreenLabel } from '../utils/screenLabels';

/**
 * ProtectedRoute — bảo vệ route bằng role và/hoặc permission.
 *
 * mode:
 * - 'strict' (mặc định): cần đủ role (nếu có) VÀ permission (nếu có)
 * - 'any': đủ role HOẶC permission là được (dùng sau khi gỡ ma trận quyền)
 *
 * - Sai ROLE (không thuộc danh sách roles, và mode=strict hoặc không có perm)
 *   -> Redirect về home của role
 * - Sai PERMISSION (có role nhưng thiếu quyền khi mode=strict, hoặc không match cả hai khi mode=any)
 *   -> Trang 403
 */
function friendlyPermissionLabel(key) {
  if (!key) return 'truy cập trang này';
  const screenLabel = getPermissionScreenLabel(key);
  if (screenLabel && screenLabel !== '—') return screenLabel;
  return 'truy cập trang này';
}

export default function ProtectedRoute({
  children,
  roles,
  permission,
  permissions,
  match = 'all', // 'all' | 'any' — cho danh sách permissions
  mode = 'strict', // 'strict' | 'any' — quan hệ giữa roles và permissions
}) {
  const { isAuthenticated, user } = useAuth();
  const { can, canAll, canAny } = usePermission();
  const { set403Error, clearError } = useGlobalError();
  const location = useLocation();
  const firedRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    refreshPermissionsApi()
      .then((res) => {
        if (res && res.token && res.user) {
          const inLocal = localStorage.getItem('token');
          const inSession = sessionStorage.getItem('token');
          const storage = res.token === inLocal ? localStorage : (res.token === inSession ? sessionStorage : null);
          if (!storage) return;

          let existing = {};
          try {
            const raw = storage.getItem('user');
            existing = raw ? JSON.parse(raw) : {};
          } catch {
            existing = {};
          }

          const mergedUser = mergeAuthRefreshUser(existing, res.user);
          storage.setItem('token', res.token);
          storage.setItem('user', JSON.stringify(mergedUser));
          const newPerms = Array.isArray(mergedUser.permissions) ? mergedUser.permissions : [];
          storage.setItem('permissions', JSON.stringify(newPerms));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'user',
            newValue: JSON.stringify(mergedUser),
            storageArea: storage,
          }));
        }
      })
      .catch((e) => {
        if (typeof console !== 'undefined') {
          console.debug('[ProtectedRoute] sync perm failed (ignored):', e?.message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permKeys = permissions
    ? permissions
    : permission
    ? [permission]
    : [];

  const hasRoleRequirement = Array.isArray(roles) && roles.length > 0;
  const hasPermRequirement = permKeys.length > 0;

  const userHasRole = hasRoleRequirement
    ? normalizeRoles(user?.roles).some((r) => roles.includes(r))
    : true;

  const userHasPermission = !hasPermRequirement
    ? true
    : (match === 'any' ? canAny(...permKeys) : canAll(...permKeys));

  // mode=any: pass nếu có role HOẶC có permission (ít nhất một phía được cấu hình và khớp)
  const accessGranted = (() => {
    if (!hasRoleRequirement && !hasPermRequirement) return true;
    if (mode === 'any') {
      if (hasRoleRequirement && userHasRole) return true;
      if (hasPermRequirement && userHasPermission) return true;
      return false;
    }
    // strict: cả hai đều phải đúng (phía không cấu hình = true)
    return userHasRole && userHasPermission;
  })();

  const missingKey = (() => {
    if (accessGranted) return null;
    if (hasPermRequirement && !userHasPermission) {
      return permKeys.find((k) => !can(k)) || permKeys[0];
    }
    return null;
  })();

  useEffect(() => {
    if (!accessGranted && missingKey) {
      if (firedRef.current !== missingKey) {
        firedRef.current = missingKey;
        const label = friendlyPermissionLabel(missingKey);
        set403Error(
          missingKey,
          `Bạn không có quyền truy cập «${label}».`,
        );
      }
    } else if (firedRef.current) {
      firedRef.current = null;
      clearError();
    }
  }, [accessGranted, missingKey, set403Error, clearError]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Không chặn render bằng "Đang đồng bộ quyền..." — tránh unmount AdminLayout
  // rồi remount → hủy request dashboard → spinner "Đang tải thống kê..." mãi.

  // Role sai + không pass qua permission (mode any) → redirect home
  if (hasRoleRequirement && !userHasRole && !(mode === 'any' && userHasPermission)) {
    return <Navigate to={getRoleHome(user)} replace />;
  }

  if (!accessGranted) {
    return null;
  }

  return children;
}
