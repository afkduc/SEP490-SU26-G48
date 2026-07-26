/**
 * RBAC cho module Kho.
 * - ADMIN: full quyen
 * - WAREHOUSE_STAFF: thuc hien thao tac hang ngay (nhap, xuat, kiem ke)
 * - MANAGER: duyet phieu nhap / xuat
 * - GENERAL_DIRECTOR: xem bao cao
 *
 * Moi role tuong ung 1 mang permission.
 * Endpoint nao can check quyen chi can `requirePerm('parts:read')` la xong.
 */
const ROLE_PERMISSIONS = {
  admin: ['*'],
  general_director: [
    'parts:read', 'stock:read', 'suppliers:read',
    'import_requests:read', 'export_requests:read',
    'reports:read',
  ],
  manager: [
    'parts:read', 'parts:write',
    'stock:read', 'stock:write',
    'suppliers:read', 'suppliers:write',
    'import_requests:read', 'import_requests:approve',
    'export_requests:read',
    'reports:read',
  ],
  warehouse_staff: [
    'parts:read',
    'stock:read', 'stock:write',
    'suppliers:read',
    'import_requests:read', 'import_requests:create',
    'export_requests:read', 'export_requests:create',
  ],
};

function can(role, perm) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(perm);
}

function requirePerm(...requiredPerms) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }
    const roles = req.user.roles || [req.user.primaryRole].filter(Boolean);
    const ok = roles.some((r) => requiredPerms.every((p) => can(r, p)));
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permission' });
    }
    return next();
  };
}

module.exports = { requirePerm, can, ROLE_PERMISSIONS };
