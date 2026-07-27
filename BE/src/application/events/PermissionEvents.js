/**
 * PermissionEvents - Event emitter singleton cho permission matrix changes.
 *
 * Dung cho SSE (Server-Sent Events) de push realtime updates den cac user
 * dang online khi admin thay doi ma tran quyen (role_permissions).
 *
 * Flow:
 *   1. Admin goi PUT /api/admin/roles/matrix/permissions -> controller luu DB
 *   2. Controller emit event 'permission-changed' voi danh sach userIds bi
 *      anh huong (collect tu role_users).
 *   3. SSE route /api/sse/permissions lang nghe event, push toi TUNG user
 *      dang co connection (filter theo userId trong JWT).
 *   4. FE nhan event -> goi GET /api/auth/me -> cap nhat token/permissions
 *      moi vao localStorage -> React re-render PermissionGate.
 *
 * Khi nao emit:
 *   - Sau khi saveRolePermissionsMatrix thanh cong.
 *   - Sau khi assignRole / revokeRole (thay doi role cua user -> quyen doi).
 *   - Sau khi admin/user_role:assign (tu UserRoleService).
 *
 * Tai sao can thiet (vs F5):
 *   - JWT co cache permissions trong payload, het han sau 24h hoac khi
 *     reissue. Neu admin revoke permission -> user token cu van co quyen
 *     do cho den khi reissue / logout / het han.
 *   - SSE dong stream giup client refresh ngay lap tuc.
 */

const { EventEmitter } = require('events');

let emitter = null;

function getEmitter() {
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(500); // cho phep nhieu user cung subscribe
  }
  return emitter;
}

/**
 * Emit permission changed event. Server se push SSE toi cac user bi anh huong.
 *
 * @param {object} payload
 * @param {number[]} payload.userIds - danh sach userId can refresh permission
 * @param {number[]} [payload.roleIds] - roleId bi thay doi (audit/debug)
 * @param {string} [payload.action] - 'matrix_updated' | 'role_assigned' | 'role_revoked'
 * @param {number} [payload.actorUserId] - nguoi thuc hien thay doi
 */
function emitPermissionChanged(payload) {
  if (!payload || !Array.isArray(payload.userIds) || payload.userIds.length === 0) {
    // Khong co user nao bi anh huong -> khong emit (tranh spam).
    return;
  }
  getEmitter().emit('permission-changed', {
    action: payload.action || 'matrix_updated',
    userIds: payload.userIds,
    roleIds: payload.roleIds || [],
    actorUserId: payload.actorUserId || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Subscribe permission change events (server-side, dung trong SSE route).
 *
 * @param {function} handler - (eventData) => void
 * @returns {function} unsubscribe function
 */
function onPermissionChanged(handler) {
  const em = getEmitter();
  em.on('permission-changed', handler);
  return () => em.off('permission-changed', handler);
}

/**
 * Dem so listener dang hoat dong (debug).
 */
function getListenerCount() {
  return getEmitter().listenerCount('permission-changed');
}

module.exports = {
  getEmitter,
  emitPermissionChanged,
  onPermissionChanged,
  getListenerCount,
};
