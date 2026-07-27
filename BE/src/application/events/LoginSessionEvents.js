/**
 * LoginSessionEvents - Event emitter singleton cho login session events.
 *
 * Dung cho SSE (Server-Sent Events) de push realtime updates den admin.
 * Su dung EventEmitter cua Node.js, ko can install them library.
 *
 * Cac event types:
 *   - 'login'    : user dang nhap thanh cong
 *   - 'logout'   : user dang xuat
 *   - 'force'    : admin force logout
 */

const { EventEmitter } = require('events');

let emitter = null;

function getEmitter() {
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(100); // cho phep nhieu admin cung luc
  }
  return emitter;
}

/**
 * Emit login session event.
 *
 * @param {string} eventType - 'login' | 'logout' | 'force'
 * @param {object} data - { userId, userName, ipAddress, browser, os, sessionId, ... }
 */
function emitLoginSessionEvent(eventType, data) {
  // serverTime: them vao event de FE tinh clockOffset (dong bo thoi gian
  // giua server & client, tranh sai lech timezone hien thi tren man login
  // history va devices).
  getEmitter().emit('login-session', eventType, {
    type: eventType,
    timestamp: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    ...data,
  });
}

/**
 * Subscribe login session events.
 *
 * @param {function} handler - (eventType, eventData) => void
 * @returns {function} unsubscribe function
 */
function onLoginSession(handler) {
  const emitter = getEmitter();
  emitter.on('login-session', handler);
  return () => emitter.off('login-session', handler);
}

/**
 * Count active listeners.
 */
function getListenerCount() {
  return getEmitter().listenerCount('login-session');
}

module.exports = {
  getEmitter,
  emitLoginSessionEvent,
  onLoginSession,
  getListenerCount,
};
