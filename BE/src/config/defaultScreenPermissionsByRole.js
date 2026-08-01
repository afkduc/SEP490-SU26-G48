/**
 * Default screen:* permissions theo role_name.
 *
 * Sau khi gỡ ma trận DB (role_screen_permissions / user_screen_permissions),
 * FE các module khác (manager / inventory / general-director) vẫn check
 * PermissionGate với key dạng screen:<module>:<resource>:<action>.
 *
 * Map này bù L2 (view/create/update/delete/export) + L1 (:access) tương ứng
 * để không làm mất nút Thao tác / ProtectedRoute của nhánh khác.
 * Admin vẫn lấy từ role_permissions (thường có '*').
 */

const ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

function expandScreen(screenKey, actions = ACTIONS) {
  const keys = [`screen:${screenKey}:access`];
  for (const a of actions) {
    keys.push(`screen:${screenKey}:${a}`);
  }
  return keys;
}

/** @type {Record<string, string[]>} */
const DEFAULT_SCREEN_PERMISSIONS_BY_ROLE = {
  // Quản lý chi nhánh — ManagerPage employees / services / technicians
  manager: [
    ...expandScreen('manager:employees'),
    ...expandScreen('manager:services'),
    ...expandScreen('manager:technicians'),
    // Manager thường cũng thao tác kho
    ...expandScreen('inventory:products'),
  ],

  // Nhân viên kho
  warehouse_staff: [
    ...expandScreen('inventory:products'),
  ],

  // Giám đốc
  general_director: [
    ...expandScreen('director:branches'),
    ...expandScreen('director:branch_managers'),
    ...expandScreen('director:employees'),
    ...expandScreen('director:technicians'),
    ...expandScreen('director:settlements'),
    ...expandScreen('director:reports'),
  ],

  // Cố vấn / tổ trưởng / KTV — hiện FE ít gate screen:*; giữ sẵn nếu sau này dùng
  service_advisor: [],
  team_leader: [],
  technician: [],

  // Admin: không cần map — thường có '*' trong role_permissions
  admin: [],
};

/**
 * @param {string[]} roleNames
 * @returns {string[]}
 */
function getDefaultScreenPermissionsForRoles(roleNames) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return [];
  const out = new Set();
  for (const raw of roleNames) {
    const name = String(raw || '').trim().toLowerCase();
    if (!name) continue;
    const keys = DEFAULT_SCREEN_PERMISSIONS_BY_ROLE[name];
    if (!keys) continue;
    for (const k of keys) out.add(k);
  }
  return [...out];
}

module.exports = {
  DEFAULT_SCREEN_PERMISSIONS_BY_ROLE,
  getDefaultScreenPermissionsForRoles,
  expandScreen,
};
