import React from 'react';
import { usePermission } from '../contexts';

/**
 * PermissionGate — component an/hien children dua tren permission.
 *
 * Cac che do hoat dong:
 *   - mode="hide"    : an hoan toan (mac dinh)
 *   - mode="disable" : hien thi nhung disabled (co the su dung voi button)
 *
 * Cac cach su dung:
 *
 * 1. An/Hien children:
 *    <PermissionGate permission="admin:users:create">
 *      <Button>Tạo người dùng</Button>
 *    </PermissionGate>
 *
 * 2. An neu khong co quyen, hien neu co:
 *    <PermissionGate permission="admin:users:create" mode="disable">
 *      <Button>Tạo người dùng</Button>
 *    </PermissionGate>
 *
 * 3. Nhieu permissions (AND):
 *    <PermissionGate permissions={['users:read', 'users:delete']} mode="hide">
 *      <DeleteButton />
 *    </PermissionGate>
 *
 * 4. Nhieu permissions (OR):
 *    <PermissionGate permissions={['users:create', 'users:manage']} match="any">
 *      <ManageButton />
 *    </PermissionGate>
 *
 * 5. Kiem tra theo props cua element con (tu dong disable):
 *    <PermissionGate check="admin:users:delete">
 *      <Button onClick={handleDelete}>Xóa</Button>
 *    </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  permissions,
  match = 'all', // 'all' | 'any'
  mode = 'hide', // 'hide' | 'disable'
  fallback = null,
}) {
  const { can, canAll, canAny } = usePermission();

  // Determine which permissions to check
  const permKeys = permissions
    ? permissions
    : permission
    ? [permission]
    : [];

  if (permKeys.length === 0) {
    return children;
  }

  // Check permissions
  const hasPermission =
    match === 'any'
      ? canAny(...permKeys)
      : canAll(...permKeys);

  if (!hasPermission) {
    if (mode === 'disable') {
      // Clone children and add disabled attribute
      return (
        <>
          {Array.isArray(children)
            ? children.map((child, i) =>
                child ? <CloneElement key={i} child={child} disabled />
              : null
            )
            : children
          ? <CloneElement child={children} disabled />
          : null}
        </>
      );
    }
    return fallback; // hide by default
  }

  return children;
}

/**
 * Clone element và thêm disabled prop.
 * Ho tro: Button, a (anchor), div, li, tr, ...
 */
function CloneElement({ child, disabled }) {
  if (!child) return null;

  // Xử lý React element
  if (child?.type) {
    return React.cloneElement(child, { disabled });
  }

  // Xử lý string/number
  if (typeof child === 'string' || typeof child === 'number') {
    return child;
  }

  return child;
}

/**
 * Sidebar menu item voi permission check.
 * An menu item neu khong co permission.
 *
 * Ví dụ:
 *   <MenuItem permission="admin:users:read" to="/admin/users" icon={Icon}>
 *     Người dùng
 *   </MenuItem>
 */
export function MenuItem({ permission, children, ...props }) {
  const { can } = usePermission();

  if (permission && !can(permission)) {
    return null;
  }

  return (
    <li {...props}>
      {children}
    </li>
  );
}

export default PermissionGate;
