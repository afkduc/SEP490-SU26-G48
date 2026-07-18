import { createContext, useContext, useCallback } from 'react';
import { useAuth } from './AppContext';

const PermissionContext = createContext(null);

/**
 * PermissionProvider — cung cap ham `can()` de kiem tra quyen tren FE.
 *
 * Quyen duoc lay tu AppContext (duoc luu khi login).
 * FE chi la lop UI — CHI dung de AN/HIEN button/menu.
 * Backend van phai kiem tra quyen that su khi nhan request.
 */
export function PermissionProvider({ children }) {
  const { permissions } = useAuth();

  /**
   * Kiem tra user co quyen nao do khong.
   * @param {string} permissionKey — VD: 'admin:users:create'
   * @returns {boolean}
   *
   * Ví dụ:
   *   const { can } = usePermission()
   *   can('admin:users:create')  // true/false
   */
  const can = useCallback(
    (permissionKey) => {
      if (!permissionKey) return false;
      if (!Array.isArray(permissions)) return false;
      // Wildcard: neu co '*' → full access
      if (permissions.includes('*')) return true;
      return permissions.includes(permissionKey);
    },
    [permissions]
  );

  /**
   * Kiem tra user co TAT CA cac quyen duoc yeu cau khong.
   * @param {...string} permissionKeys
   * @returns {boolean}
   *
   * Ví dụ:
   *   canAll('users:read', 'users:delete')
   */
  const canAll = useCallback(
    (...permissionKeys) => {
      if (!permissionKeys || permissionKeys.length === 0) return true;
      return permissionKeys.every((p) => can(p));
    },
    [can]
  );

  /**
   * Kiem tra user co IТ NHAТ 1 trong cac quyen duoc yeu cau khong.
   * @param {...string} permissionKeys
   * @returns {boolean}
   *
   * Ví dụ:
   *   canAny('users:create', 'users:manage')
   */
  const canAny = useCallback(
    (...permissionKeys) => {
      if (!permissionKeys || permissionKeys.length === 0) return true;
      return permissionKeys.some((p) => can(p));
    },
    [can]
  );

  const value = {
    permissions,
    can,
    canAll,
    canAny,
    permissionCount: Array.isArray(permissions) ? permissions.length : 0,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Hook de su dung permission trong component.
 *
 * Ví dụ:
 *   function CreateUserButton() {
 *     const { can } = usePermission();
 *     if (!can('admin:users:create')) return null;
 *     return <button>Tạo người dùng</button>;
 *   }
 *
 * Hoac voi HOC/enhanced components:
 *   function DeleteButton({ permission, children, ...props }) {
 *     const { can } = usePermission();
 *     if (!can(permission)) return null;
 *     return <button {...props}>{children}</button>;
 *   }
 *   <DeleteButton permission="admin:users:delete">Xóa</DeleteButton>
 */
export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    // Fallback: neu khong co PermissionProvider, su dung gia tri tu AppContext
    const auth = useAuth();
    const { permissions } = auth;

    const can = (key) => {
      if (!key) return false;
      if (!Array.isArray(permissions)) return false;
      if (permissions.includes('*')) return true;
      return permissions.includes(key);
    };
    const canAll = (...keys) => keys.every((k) => can(k));
    const canAny = (...keys) => keys.some((k) => can(k));

    return { permissions, can, canAll, canAny, permissionCount: permissions?.length || 0 };
  }
  return ctx;
}

export default PermissionContext;
