/**
 * ImportRequestRepository – truy van / thao tac voi bang `import_requests`
 * va `import_request_items`. Moi method trien khai trong Impl.
 *
 * Luu y quan trong:
 * - approve() PHAI thuc hien trong 1 transaction:
 *     1) UPDATE import_requests SET status='approved'
 *     2) Cong stock_quantity cho moi item vao bang products
 *     3) INSERT 1 dong inventory_transactions (transaction_type='import')
 *     neu 1 trong 3 buoc loi -> rollback toan bo.
 */
class ImportRequestRepository {
  /**
   * Loc + phan trang danh sach phieu nhap.
   * @param {Object} filters - { branchId, status, supplierId, fromDate, toDate, search, page, limit }
   * @returns {Promise<ImportRequest[]>}
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
   * Lay chi tiet 1 phieu nhap kem items.
   * @param {number} id
   * @returns {Promise<{ request: ImportRequest, items: ImportRequestItem[] }|null>}
   */
  async findById(id, options = {}) {
    throw new Error('Method findById() must be implemented');
  }

  /**
   * Lay danh sach items cua 1 phieu.
   * @param {number} importRequestId
   * @returns {Promise<ImportRequestItem[]>}
   */
  async findItemsByRequestId(importRequestId) {
    throw new Error('Method findItemsByRequestId() must be implemented');
  }

  /**
   * Sinh ma phieu tiep theo: IRB-{branchId}-{YYYYMMDD}-{sequence:4}
   * @param {number} branchId
   * @param {Date} date
   * @returns {Promise<string>}
   */
  async getNextRequestCode(branchId, date, tx = null) {
    throw new Error('Method getNextRequestCode() must be implemented');
  }

  /**
   * Tao phieu nhap moi (status='pending') + insert items.
   * Can truyen transaction handle de dam bao atom.
   * @param {Object} tx - msnodesqlv8 transaction
   * @param {Object} requestData - { request_code, branch_id, supplier_id, supplier_invoice_no, requested_by, import_date, notes }
   * @param {Array<Object>} items - [{ product_id, product_code, product_name, unit, quantity }]
   * @returns {Promise<number>} id moi tao
   */
  async create(tx, requestData, items) {
    throw new Error('Method create() must be implemented');
  }

  /**
   * Duyet phieu nhap (transaction):
   *   1) UPDATE import_requests SET status='approved', approved_by, import_date
   *   2) UPDATE products.stock_quantity += quantity (voi moi item)
   *   3) INSERT inventory_transactions (transaction_type='import') (voi moi item)
   * @param {Object} tx
   * @param {number} id
   * @param {number} approvedBy
   * @param {Date} importDate
   * @returns {Promise<{ request: ImportRequest, items: ImportRequestItem[] }>}
   *   request + items de service sinh transaction_code + INSERT logs
   */
  async approve(tx, id, approvedBy, importDate, options = {}) {
    throw new Error('Method approve() must be implemented');
  }

  /**
   * Tu choi phieu (transaction don gian).
   * @param {Object} tx
   * @param {number} id
   * @param {number} rejectedBy
   * @param {string} rejectReason
   * @returns {Promise<boolean>} true neu thanh cong, false neu khong o trang thai pending
   */
  async reject(tx, id, rejectedBy, rejectReason, options = {}) {
    throw new Error('Method reject() must be implemented');
  }
}

module.exports = ImportRequestRepository;