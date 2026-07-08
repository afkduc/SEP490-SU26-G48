/**
 * InventoryRepository – truy van ton kho theo chi nhanh va san pham.
 * Hien tai lay truc tiep tu bang `products` (da co stock_quantity).
 * Neu sau nay co bang `inventory` rieng thi chi can sua impl.
 */
class InventoryRepository {
  /**
   * Lay danh sach ton kho theo chi nhanh.
   * @param {number} branchId
   * @param {Object} filters - { search, category, lowStockOnly, page, limit }
   * @returns {Promise<Product[]>}
   */
  async getStockByBranch(branchId, filters = {}) {
    throw new Error('Method getStockByBranch() must be implemented');
  }

  /**
   * Dem tong so ban ghi ton kho (cho phan trang).
   * @param {number} branchId
   * @param {Object} filters
   * @returns {Promise<number>}
   */
  async countStockByBranch(branchId, filters = {}) {
    throw new Error('Method countStockByBranch() must be implemented');
  }

  /**
   * Lay danh sach san pham nam duoi muc ton toi thieu.
   * @param {number} branchId
   * @returns {Promise<Product[]>}
   */
  async getLowStock(branchId) {
    throw new Error('Method getLowStock() must be implemented');
  }

  /**
   * Lay chi tiet ton kho mot san pham.
   * @param {number} productId
   * @param {number} branchId
   * @returns {Promise<Product|null>}
   */
  async getStockByProduct(productId, branchId) {
    throw new Error('Method getStockByProduct() must be implemented');
  }

  /**
   * Cap nhat so luong ton kho (dung cho nhap/xuat kho).
   * @param {number} productId
   * @param {number} branchId
   * @param {number} quantity - so luong thay doi (am = tru, duong = cong)
   * @returns {Promise<Product>}
   */
  async updateStock(productId, branchId, quantity) {
    throw new Error('Method updateStock() must be implemented');
  }

  /**
   * Tong hop ton kho theo category (cho dashboard).
   * @param {number} branchId
   * @returns {Promise<Object[]>}
   */
  async getStockSummaryByCategory(branchId) {
    throw new Error('Method getStockSummaryByCategory() must be implemented');
  }
}

module.exports = InventoryRepository;
