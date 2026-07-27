import { createContext, useContext, useCallback, useMemo } from 'react';
import { useAuth } from './AppContext';

const PermissionContext = createContext(null);

const L2_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

/**
 * PermissionProvider — cung cap ham `can()` de kiem tra quyen tren FE.
 *
 * Quyen duoc lay tu AppContext (login / refresh / getMe).
 * FE chi la lop UI — CHI dung de AN/HIEN button/menu.
 * Backend van phai kiem tra quyen that su khi nhan request.
 *
 * Luồng 2 lớp:
 *   L1: canScreen('director:branches')      → screen:director:branches:access
 *   L2: canScreenAction('director:branches', 'create') → screen:director:branches:create
 */
export function PermissionProvider({ children }) {
  const { permissions } = useAuth();

  const can = useCallback(
    (permissionKey) => {
      if (!permissionKey) return false;
      if (!Array.isArray(permissions)) return false;
      if (permissions.includes('*')) return true;
      if (permissions.includes(permissionKey)) return true;
      // L1 screen:X:access được coi là có nếu đã có bất kỳ L2 action nào trên cùng screen
      // (tránh lệch sync tạm thời giữa role_permissions và role_screen_permissions).
      const accessMatch = String(permissionKey).match(/^screen:(.+):access$/i);
      if (accessMatch) {
        const screenKey = accessMatch[1];
        return L2_ACTIONS.some((action) =>
          permissions.includes(`screen:${screenKey}:${action}`)
        );
      }
      return false;
    },
    [permissions]
  );

  const canAll = useCallback(
    (...permissionKeys) => {
      if (!permissionKeys || permissionKeys.length === 0) return true;
      return permissionKeys.every((p) => can(p));
    },
    [can]
  );

  const canAny = useCallback(
    (...permissionKeys) => {
      if (!permissionKeys || permissionKeys.length === 0) return true;
      return permissionKeys.some((p) => can(p));
    },
    [can]
  );

  /** L1 — vào được màn hình */
  const canScreen = useCallback(
    (screenKey) => {
      if (!screenKey) return false;
      if (can('*')) return true;
      const key = String(screenKey).startsWith('screen:')
        ? screenKey
        : `screen:${screenKey}:access`;
      // Cho phép truyền sẵn screen:X:access hoặc chỉ module:resource
      if (can(key)) return true;
      if (String(screenKey).startsWith('screen:') && String(screenKey).endsWith(':access')) {
        return can(screenKey);
      }
      return can(`screen:${screenKey}:access`);
    },
    [can]
  );

  /**
   * L2 — nút/chức năng trong màn hình.
   * @param {string} screenKey  vd: 'director:branch_managers' hoặc 'branches'
   * @param {'view'|'create'|'update'|'delete'|'export'} action
   */
  const canScreenAction = useCallback(
    (screenKey, action) => {
      if (!screenKey || !action) return false;
      if (can('*')) return true;
      const normalizedAction = String(action).toLowerCase();
      if (!L2_ACTIONS.includes(normalizedAction)) return false;
      const sk = String(screenKey)
        .replace(/^screen:/, '')
        .replace(/:access$/, '');
      return can(`screen:${sk}:${normalizedAction}`);
    },
    [can]
  );

  const value = useMemo(
    () => ({
      permissions,
      can,
      canAll,
      canAny,
      canScreen,
      canScreenAction,
      permissionCount: Array.isArray(permissions) ? permissions.length : 0,
    }),
    [permissions, can, canAll, canAny, canScreen, canScreenAction]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
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
    const canScreen = (screenKey) => {
      if (!screenKey) return false;
      if (can('*')) return true;
      const sk = String(screenKey).replace(/^screen:/, '').replace(/:access$/, '');
      return can(`screen:${sk}:access`);
    };
    const canScreenAction = (screenKey, action) => {
      if (!screenKey || !action) return false;
      if (can('*')) return true;
      const sk = String(screenKey).replace(/^screen:/, '').replace(/:access$/, '');
      return can(`screen:${sk}:${String(action).toLowerCase()}`);
    };

    return {
      permissions,
      can,
      canAll,
      canAny,
      canScreen,
      canScreenAction,
      permissionCount: permissions?.length || 0,
    };
  }
  return ctx;
}

export default PermissionContext;
