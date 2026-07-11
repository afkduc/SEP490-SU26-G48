import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { getRoleHome } from '../contexts/AppContext';

/**
 * Redirect "/" ve dung trang home theo role cua user.
 * Neu chua login thi ve /dashboard (mac dinh).
 */
export default function RoleAwareRedirect() {
  const { user } = useAuth();
  return <Navigate to={getRoleHome(user)} replace />;
}
