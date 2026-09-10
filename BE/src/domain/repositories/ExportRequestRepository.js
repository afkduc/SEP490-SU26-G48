/**
 * ExportRequestRepository - truy van / thao tac voi bang `export_requests`
 * va `export_request_items`. Moi method trien khai trong Impl.
 *
 * Luu y quan trong (khac ImportRequest):
 * - KHONG can Manager duyet - NVKho xuat truc tiep theo Repair Order.
 * - create() PHAI thuc hien trong 1 transaction:
 *     1) INSERT export_requests (status='completed')
 *     2) INSERT export_request_items
 *     3) UPDATE products.stock_quantity -= quantity (CHECK stock >= quantity)
 *     4) INSERT inventory_transactions (transaction_type='export')
 *     neu 1 trong 4 buoc loi -> rollback toan bo.
 *
 * - Phu tung can xuat duoc trich tu repair_order_tasks WHERE task_type='product'.
 *   Khi NVKho xuat, BE se lay cac phu tung do lam "snapshot" va cho phep
 *   dieu chinh quantity (vi co the xuat khong het hoac them phu tung phat sinh).
 */
class ExportRequestRepository {
  /**
   * Loc + phan trang danh sach phieu xuat.
   * @param {Object} filters - { branchId, status, fromDate, toDate, search, page, limit }
   * @returns {Promise<ExportRequest[]>}
   */
  async findAll(filters = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  /**
   * Dem tong ban ghi (cho phan trang).
   * @param {Object} filters
   * @returns {Promise<number>}
   */
  async count(filters = {}) {
    throw new Error('Method count() must be implemented');
  }

  /**
   * Lay chi tiet 1 phieu xuat kem items.
   * @param {number} id
   * @returns {Promise<{ request: ExportRequest, items: ExportRequestItem[] }|null>}
   */
  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  /**
   * Lay danh sach items cua 1 phieu.
   * @param {number} exportRequestId
   * @returns {Promise<ExportRequestItem[]>}
   */
  async findItemsByRequestId(exportRequestId) {
    throw new Error('Method findItemsByRequestId() must be implemented');
  }

  /**
   * Lay cac Repair Order co the xuat kho (status <> 'cancelled', bao gom ca
   * 'inprogress' va 'completed') va chua tung duoc xuat cho RO do. Tra ve kem
   * tasks (product) de FE hien thi.
   * @param {Object} filters - { branchId, search, page, limit }
   * @returns {Promise<Array<{ id, repairOrderCode, repairOrderCode, customerName, vehiclePlate, status, items: Array }>>}
   */
  async findExportableRepairOrders(filters = {}) {
    throw new Error('Method findExportableRepairOrders() must be implemented');
  }

  /**
   * Lay 1 Repair Order kem cac phu tung (task_type='product') chua xuat.
   * @param {number} repairOrderId
   * @returns {Promise<{ repairOrderCode, customerName, vehiclePlate, status, items: Array }|null>}
   */
  async findRepairOrderForExport(repairOrderId) {
    throw new Error('Method findRepairOrderForExport() must be implemented');
  }

  /**
   * Danh sach tho may dang hoat dong cua 1 chi nhanh - dropdown "Nguoi lay"
   * khi tao phieu xuat.
   * @param {number} branchId
   * @returns {Promise<Array<{ id, employeeId, fullName }>>}
   */
  async findTechnicians(branchId) {
    throw new Error('Method findTechnicians() must be implemented');
  }

  /**
   * Tao phieu xuat moi (status='completed') + insert items + tru stock + ghi log.
   * Ma phieu (request_code) = ma cua chinh Lenh sua chua (repair_code) - repo
   * tu lay trong cung transaction, khong nhan tu requestData.
   * Toan bo trong 1 transaction. Neu stock khong du -> throw error, rollback.
   * @param {Object} tx - msnodesqlv8 transaction
   * @param {Object} requestData - { branch_id, repair_order_id, performed_by, received_by, received_signature_data, export_date, notes }
   * @param {Array<Object>} items - [{ product_id, product_code, product_name, unit, quantity }]
   * @returns {Promise<{ request: ExportRequest, items: ExportRequestItem[] }>}
   */
  async create(tx, requestData, items) {
    throw new Error('Method create() must be implemented');
  }

  /**
   * Danh dau 1 phieu la "da xem" boi Manager.
   * @param {number} id
   */
  async markSeenByManager(id) {
    throw new Error('Method markSeenByManager() must be implemented');
  }

  /**
   * Dem so phieu chua duoc Manager xem trong 1 chi nhanh.
   * @param {number} branchId
   * @returns {Promise<number>}
   */
  async countNewForManager(branchId) {
    throw new Error('Method countNewForManager() must be implemented');
  }
}

module.exports = ExportRequestRepository;