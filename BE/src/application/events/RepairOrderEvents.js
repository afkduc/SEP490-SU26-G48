/**
 * RepairOrderEvents - Event emitter singleton cho realtime "Lenh sua chua",
 * scope theo branchId (giong ServiceRequestEvents) - chi CVDV/to truong cung
 * chi nhanh moi can biet cac thay doi nay.
 *
 * Event types:
 *   - 'assigned'         : CVDV vua tao lenh sua chua, gan cho 1 to truong
 *                           (payload co teamLeaderId de FE loc dung nguoi)
 *   - 'task-updated'      : to truong vua tich hoan thanh 1 dau muc cong viec
 *   - 'order-completed'   : to truong vua hoan thanh toan bo lenh sua chua
 *                           (phieu quyet toan goc chuyen sang "Cho thanh toan")
 *   - 'invoiced'          : PayOS webhook bao da nhan tien -> phieu tu dong
 *                           chuyen sang "Da xuat hoa don" (RepairSettlementService
 *                           .handlePayosWebhook), khong can CVDV bam xac nhan.
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
  return `repair-order:${branchId}`;
}

/**
 * @param {number} branchId
 * @param {string} type - 'assigned' | 'task-updated' | 'order-completed'
 * @param {object} data
 */
function emitRepairOrderEvent(branchId, type, data) {
  getEmitter().emit(eventName(branchId), { type, ...data });
}

/**
 * @param {number} branchId
 * @param {function} handler - (eventData) => void
 * @returns {function} unsubscribe
 */
function onRepairOrderEvent(branchId, handler) {
  const em = getEmitter();
  em.on(eventName(branchId), handler);
  return () => em.off(eventName(branchId), handler);
}

module.exports = { emitRepairOrderEvent, onRepairOrderEvent };
