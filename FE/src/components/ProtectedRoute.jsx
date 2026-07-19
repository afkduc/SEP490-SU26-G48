import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { usePermission } from '../contexts';
import { getRoleHome, normalizeRoles } from '../contexts/AppContext';

/**
 * ProtectedRoute — bảo vệ route bằng role và/hoặc permission.
 *
 * Cac cach su dung:
 *
 * 1. Chi can login:
 *    <ProtectedRoute>
 *      <DashboardPage />
 *    </ProtectedRoute>
 *
 * 2. Can role cu the:
 *    <ProtectedRoute roles={['admin']}>
 *      <AdminPage />
 *    </ProtectedRoute>
 *
 * 3. Can permission cu the:
 *    <ProtectedRoute permission="users:read">
 *      <UserListPage />
 *    </ProtectedRoute>
 *
 * 4. Can nhieu permissions (AND):
 *    <ProtectedRoute permissions={['users:read', 'users:delete']}>
 *      <UserPage />
 *    </ProtectedRoute>
 *
 * 5. Can nhieu permissions (OR):
 *    <ProtectedRoute permissions={['users:create']} match="any">
 *      <CreateUserPage />
 *    </ProtectedRoute>
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
  const location = useLocation();

  // Buoc 1: Kiem tra authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Buoc 2: Kiem tra role (neu co)
  if (roles && roles.length > 0) {
    const hasRole = normalizeRoles(user?.roles).some((r) => roles.includes(r));
    if (!hasRole) {
      return <Navigate to={getRoleHome(user)} replace />;
    }
  }

  // Buoc 3: Kiem tra granular permission (neu co)
  const permKeys = permissions
    ? permissions
    : permission
    ? [permission]
    : [];

  if (permKeys.length > 0) {
    const hasPermission =
      match === 'any'
        ? canAny(...permKeys)
        : canAll(...permKeys);

    if (!hasPermission) {
      // Redirect ve trang chinh cua user thay vi /unauthorized
      return <Navigate to={getRoleHome(user)} replace />;
    }
  }

  return children;
}
