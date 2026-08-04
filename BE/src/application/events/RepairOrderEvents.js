/**
 * RepairOrderEvents - Event emitter singleton cho realtime "Lenh sua chua",
 * scope theo branchId (giong ServiceRequestEvents) - chi CVDV/to truong cung
 * chi nhanh moi can biet cac thay doi nay.
 *
 * Event types:
 *   - 'new-pending'       : co phieu quyet toan moi o trang thai waiting_repair
 *                           (vua tao, hoac lenh sua chua bi huy giua chung) -
 *                           bang tin cac khoang xe tu them dong moi.
 *   - 'claimed'           : 1 khoang xe vua nhan 1 phieu (payload co bayId de
 *                           cac khoang khac biet phieu nay het con, tu go dong).
 *   - 'task-updated'      : to truong vua tich hoan thanh 1 dau muc cong viec
 *   - 'order-completed'   : to truong vua hoan thanh toan bo lenh sua chua
 *                           (phieu quyet toan goc chuyen sang "Cho thanh toan")
 *   - 'invoiced'          : PayOS webhook bao da nhan tien -> phieu tu dong
 *                           chuyen sang "Da xuat hoa don" (RepairSettlementService
 *                           .handlePayosWebhook), khong can CVDV bam xac nhan.
 *   - 'bay-occupied'/'bay-released' : 1 khoang xe vua co/mat tablet dang chiem -
 *                           xem VehicleBayService, dung cho man CVDV "Khoang xe
 *                           dang hoat dong".
 *   - 'order-cancelled'   : CVDV huy phieu (tu waiting_repair hoac inprogress) -
 *                           xem RepairSettlementService.updateStatus.
 *   - 'gate-exit-confirmed' : Bao ve xac nhan xe da ra cong (man hinh cong,
 *                           public khong dang nhap) - xem publicRoutes.js
 *                           /public/gate/*, sseRoutes.js /sse/gate.
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
