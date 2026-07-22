/**
 * ServiceRequestEvents - Event emitter singleton cho realtime "Yeu cau"
 * (form "Lien he" tu landing page) - scope theo branchId thay vi global,
 * vi chi CVDV cung chi nhanh moi can thay yeu cau do.
 *
 * Event types:
 *   - 'new-request'      : co yeu cau moi tu landing page
 *   - 'request-updated'  : mot CVDV vua tiep nhan yeu cau (de cac CVDV
 *                           khac cung chi nhanh cap nhat nut ngay)
 */

const { EventEmitter } = require('events');

let emitter = null;

function getEmitter() {
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(100);
  }
  return emitter;
}

function eventName(branchId) {
  return `service-request:${branchId}`;
}

/**
 * @param {number} branchId
 * @param {string} type - 'new-request' | 'request-updated'
 * @param {object} data
 */
function emitServiceRequestEvent(branchId, type, data) {
  getEmitter().emit(eventName(branchId), { type, ...data });
}

/**
 * @param {number} branchId
 * @param {function} handler - (eventData) => void
 * @returns {function} unsubscribe
 */
function onServiceRequestEvent(branchId, handler) {
  const em = getEmitter();
  em.on(eventName(branchId), handler);
  return () => em.off(eventName(branchId), handler);
}

module.exports = { emitServiceRequestEvent, onServiceRequestEvent };
