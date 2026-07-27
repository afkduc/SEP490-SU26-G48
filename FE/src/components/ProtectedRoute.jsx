import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { usePermission } from '../contexts';
import { getRoleHome, normalizeRoles } from '../contexts/AppContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { useEffect, useRef, useState } from 'react';
import { refreshPermissionsApi } from '../services/authApi';

/**
 * ProtectedRoute — bảo vệ route bằng role và/hoặc permission.
 *
 * Phan biet 2 loai chan truy cap (production-grade):
 *
 * - Sai ROLE (VD: user dang nhap nhung khong phai admin)
 *   -> Redirect ve trang home cua role (UX binh thuong, khong gay so)
 *
 * - Sai PERMISSION (user co role admin nhung admin vua tick bo permission)
 *   -> Show trang 403 full-screen voi nut "Yeu cau cap quyen"
 *   -> Day moi la dung production-grade: nguoi dung hieu ro quyen cua minh,
 *      khong bi "redirect home" am tham.
 *
 * PLAN A — Auto-sync permission tu DB (fix bug "admin go quyen nhung user
 * van vao duoc trang"):
 *
 *   - Khi mount: goi POST /auth/refresh-permissions de lay JWT moi nhat
 *     tu DB (bo qua cache BE). Sau do storage event -> AppContext state
 *     update -> usePermission tu cap nhat -> ProtectedRoute re-render
 *     -> set403Error neu thieu permission.
 *
 *   - Truoc khi sync xong (lan dau), render placeholder de tranh render
 *     nham frame voi permission cu trong JWT.
 *
 * BE cung check real-time qua PermissionService (skipCache=true) nen du
 * FE co stale JWT, BE van chan dung.
 */
export default function ProtectedRoute({
  children,
  roles,
  permission,
  permissions,
  match = 'all', // 'all' | 'any'
}) {
  const { isAuthenticated, user } = useAuth();
  const { can, canAll, canAny } = usePermission();
  const { set403Error, clearError } = useGlobalError();
  const location = useLocation();
  // Anti-spam 403: neu permission dang thieu, set 1 lan. Khi permission duoc
  // tra lai -> clearError(). Khi missingKey thay doi (chuyen trang) -> set
  // 1 lan. Tranh loop toast/endless set403Error lien tuc.
  const firedRef = useRef(null);
  // Track da sync permission lan dau chua (fix stale JWT sau F5)
  const [syncDone, setSyncDone] = useState(false);

  // PLAN A: Sync permissions tu DB ngay khi mount (lan dau sau F5/navigate).
  // Dam bao JWT trong storage dong bo voi DB truoc khi check quyen, de tranh
  // user pass nham vi JWT cu van co permission da bi revoke.
  //
  // QUAN TRONG: chi chay 1 lan duy nhat khi mount (empty dep array).
  // Truoc day: useEffect phu thuoc [isAuthenticated] -> khi SSE refresh JWT
  // moi lam token/permissions trong state thay doi -> effect re-fire -> goi
  // refreshPermissionsApi lan nua -> co the 401/403 (stale token) -> hien
  // SessionExpiredModal + set403Error lien tuc -> loop toast.
  // Fix: chi chay 1 lan khi component mount, IS_AUTHENTICATED check
  // duoc dam bao bang cach: khi login xong, AppContext dispatch storage
  // event -> navigate -> mount ProtectedRoute moi voi isAuthenticated=true.
  useEffect(() => {
    if (!isAuthenticated) return;

    // Neu SSO gate (IdP) chua init xong, khong can sync.
    // Refresh chi can 1 lan khi user vua truy cap trang (lan dau sau login/F5).
    refreshPermissionsApi()
      .then((res) => {
        if (res && res.token && res.user) {
          const inLocal = localStorage.getItem('token');
          const storage = res.token === inLocal ? localStorage : sessionStorage;
          storage.setItem('token', res.token);
          storage.setItem('user', JSON.stringify(res.user));
          const newPerms = Array.isArray(res.user?.permissions) ? res.user.permissions : [];
          storage.setItem('permissions', JSON.stringify(newPerms));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'token',
            newValue: res.token,
            storageArea: storage,
          }));
        }
      })
      .catch((e) => {
        // Loi o day: 401 (token expired) hoac 403 (bi revoke) -> httpClient
        // da dispatch SESSION_EXPIRED/FORBIDDEN event roi. Day la thong bao
        // tham thoi ve permission cu co the sai so voi DB, nhung cung khong
        // the fix bang cach retry lien tuc (se thanh loop). Bo qua.
        if (typeof console !== 'undefined') {
          console.debug('[ProtectedRoute] sync perm failed (ignored):', e?.message);
        }
      })
      .finally(() => {
        setSyncDone(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← INTENTIONALLY empty: chi chay 1 lan khi mount

  // Effect dong bo: khi permission thay doi (admin vua tick bo) -> set403Error,
  // khi permission duoc tra lai -> clearError.
  const permKeys = permissions
    ? permissions
    : permission
    ? [permission]
    : [];

  const hasPermission = permKeys.length === 0
    ? true
    : (match === 'any' ? canAny(...permKeys) : canAll(...permKeys));

  const missingKey = hasPermission
    ? null
    : (permKeys.find((k) => !can(k)) || permKeys[0]);

  useEffect(() => {
    if (missingKey) {
      if (firedRef.current !== missingKey) {
        firedRef.current = missingKey;
        set403Error(
          missingKey,
          `Bạn không có quyền "${missingKey}" để truy cập trang này.`
        );
      }
    } else if (firedRef.current) {
      firedRef.current = null;
      clearError();
    }
  }, [missingKey, set403Error, clearError]);

  // ===== EARLY RETURNS (phai dat SAU hooks) =====

  // Buoc 1: Kiem tra authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Cho render placeholder trong khi sync permission lan dau.
  // Tranh nhay frame "thay quyen" khi JWT cu van co permission cu.
  if (!syncDone) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#6b7280',
        fontSize: 14,
      }}>
        Đang đồng bộ quyền...
      </div>
    );
  }

  // Buoc 2: Kiem tra role (neu co)
  if (roles && roles.length > 0) {
    const hasRole = normalizeRoles(user?.roles).some((r) => roles.includes(r));
    if (!hasRole) {
      return <Navigate to={getRoleHome(user)} replace />;
    }
  }

  if (missingKey) {
    return null; // ErrorHandler show UnauthorizedPage full-screen
  }

  return children;
}