import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { usePermission } from '../contexts';
import { getRoleHome, normalizeRoles } from '../contexts/AppContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { useEffect, useRef } from 'react';

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
 * Permission check doc tu JWT permissions (frontend cache cua AuthService).
 * BE cung check real-time qua PermissionService, vi the neu admin vua thu hoi
 * quyen o tab khac, SSE se push permission-changed -> FE refresh token ->
 * usePermission tu cap nhat -> ProtectedRoute re-render -> set403Error.
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
  // Anti-spam: tranh set403Error lien tuc neu component re-render nhieu lan
  const firedRef = useRef(null);

  // Buoc 1: Kiem tra authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Buoc 2: Kiem tra role (neu co)
  if (roles && roles.length > 0) {
    const hasRole = normalizeRoles(user?.roles).some((r) => roles.includes(r));
    if (!hasRole) {
      // Sai role -> redirect home (cu - khong phai 403 permission)
      return <Navigate to={getRoleHome(user)} replace />;
    }
  }

  // Buoc 3: Kiem tra granular permission (neu co)
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

  // Effect dong bo: khi permission thay doi (admin vua tick bo) -> set403Error,
  // khi permission duoc tra lai -> clearError.
  useEffect(() => {
    if (missingKey) {
      // Chi dispatch 1 lan cho moi permission key (tranh spam)
      if (firedRef.current !== missingKey) {
        firedRef.current = missingKey;
        set403Error(
          missingKey,
          `Bạn không có quyền "${missingKey}" để truy cập trang này.`
        );
      }
    } else if (firedRef.current) {
      // Permission duoc tra lai (admin vua tick lai) -> clear
      firedRef.current = null;
      clearError();
    }
  }, [missingKey, set403Error, clearError]);

  if (missingKey) {
    // Render null trong khi ErrorHandler show UnauthorizedPage full-screen
    return null;
  }

  return children;
}
