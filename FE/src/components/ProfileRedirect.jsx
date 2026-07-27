import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, getRoleProfilePath, getRoleProfileEditPath } from '../contexts/AppContext';

/**
 * Redirect /profile (legacy) ve dung URL ho so theo role.
 */
export default function ProfileRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  const isEdit = location.pathname.endsWith('/edit');
  return (
    <Navigate
      to={isEdit ? getRoleProfileEditPath(user) : getRoleProfilePath(user)}
      replace
    />
  );
}
