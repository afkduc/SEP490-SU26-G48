/**
 * PermissionEvents - Event emitter cho thay doi quyen user (SSE).
 *
 * Push realtime den user dang online khi role cua ho bi gan/thu hoi
 * (assignRoles / revokeRole). Ma tran role_permissions UI da go.
 *
 * Flow:
 *   1. Admin gan/thu role user -> controller emit 'permission-changed'
 *   2. SSE /api/sse/permissions push theo userId
 *   3. FE nhan event -> refresh token/permissions
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
 * @param {string} [payload.action] - 'role_assigned' | 'role_revoked' | 'permissions_changed'
 * @param {number} [payload.actorUserId] - nguoi thuc hien thay doi
 */
function emitPermissionChanged(payload) {
  if (!payload || !Array.isArray(payload.userIds) || payload.userIds.length === 0) {
    // Khong co user nao bi anh huong -> khong emit (tranh spam).
    return;
  }
  getEmitter().emit('permission-changed', {
    action: payload.action || 'permissions_changed',
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
