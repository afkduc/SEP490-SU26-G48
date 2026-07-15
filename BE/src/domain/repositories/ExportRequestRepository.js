/**
 * ExportRequestRepository - truy van / thao tac voi bang `export_requests`
 * va `export_request_items`. Moi method trien khai trong Impl.
 *
 * Luu y quan trong (khac ImportRequest):
 * - KHONG can Manager duyet - NVKho xuat truc tiep theo Service Order.
 * - create() PHAI thuc hien trong 1 transaction:
 *     1) INSERT export_requests (status='completed')
 *     2) INSERT export_request_items
 *     3) UPDATE products.stock_quantity -= quantity (CHECK stock >= quantity)
 *     4) INSERT inventory_transactions (transaction_type='export')
 *     neu 1 trong 4 buoc loi -> rollback toan bo.
 *
 * - Phu tung can xuat duoc trich tu service_order_items WHERE item_type='PART'.
 *   Khi NVKho xuat, BE se lay cac phu tung do lam "snapshot" va cho phep
 *   dieu chinh quantity (vi co the xuat khong het hoac them phu tung phat sinh).
 */
class ExportRequestRepository {
  /**
   * Loc + phan trang danh sach phieu xuat.
   * @param {Object} filters - { branchId, status, serviceOrderId, fromDate, toDate, search, page, limit }
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
   * Sinh ma phieu tiep theo: EXB-{branchId}-{YYYYMMDD}-{sequence:4}
   * @param {number} branchId
   * @param {Date} date
   * @returns {Promise<string>}
   */
  async getNextRequestCode(branchId, date) {
    throw new Error('Method getNextRequestCode() must be implemented');
  }

  /**
   * Lay cac Service Order co the xuat kho (status IN ('invoiced','waiting_payment','inprogress')
   * va chua tung duoc xuat cho SO do). Tra ve kem items (PART) de FE hien thi.
   * @param {Object} filters - { branchId, search, page, limit }
   * @returns {Promise<Array<{ id, orderCode, customerName, vehiclePlate, status, items: Array }>>}
   */
  async findExportableServiceOrders(filters = {}) {
    throw new Error('Method findExportableServiceOrders() must be implemented');
  }

  /**
   * Lay 1 Service Order kem cac phu tung (item_type='PART') chua xuat.
   * @param {number} serviceOrderId
   * @returns {Promise<{ orderCode, customerName, vehiclePlate, status, items: Array }|null>}
   */
  async findServiceOrderForExport(serviceOrderId) {
    throw new Error('Method findServiceOrderForExport() must be implemented');
  }

  /**
   * Tao phieu xuat moi (status='completed') + insert items + tru stock + ghi log.
   * Toan bo trong 1 transaction. Neu stock khong du -> throw error, rollback.
   * @param {Object} tx - msnodesqlv8 transaction
   * @param {Object} requestData - { request_code, branch_id, service_order_id, performed_by, export_date, notes }
   * @param {Array<Object>} items - [{ product_id, product_code, product_name, unit, quantity }]
   * @returns {Promise<{ request: ExportRequest, items: ExportRequestItem[] }>}
   */
  async create(tx, requestData, items) {
    throw new Error('Method create() must be implemented');
  }
}

module.exports = ExportRequestRepository;