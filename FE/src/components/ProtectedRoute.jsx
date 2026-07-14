import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { getRoleHome, normalizeRoles } from '../contexts/AppContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0) {
    const hasRole = normalizeRoles(user?.roles).some((r) => roles.includes(r));
    if (!hasRole) {
      return <Navigate to={getRoleHome(user)} replace />;
    }
  }

  return children;
}
