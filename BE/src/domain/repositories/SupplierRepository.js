/**
 * SupplierRepository – truy van nha cung cap.
 * Hien tai chi dung read-only (list/getById) vi UC kho chi can xem.
 */
class SupplierRepository {
  /**
   * Lay danh sach nha cung cap (co filter search/status).
   * @param {Object} filters - { search?, status? }
   * @returns {Promise<Supplier[]>}
   */
  async findAll(filters = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  /**
   * Lay mot nha cung cap theo id.
   * @param {number} id
   * @returns {Promise<Supplier|null>}
   */
  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }
}

module.exports = SupplierRepository;