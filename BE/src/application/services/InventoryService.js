const ApiError = require('../../utils/ApiError');
const InventoryResponseDto = require('../dto/InventoryResponseDto');
const { normalizeVietnamese } = require('../../utils/vietnamese');

class InventoryService {
  constructor({ inventoryRepository }) {
    this.inventoryRepository = inventoryRepository;
  }

  async getStockList({ branchId, search, category, lowStockOnly, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [items, total] = await Promise.all([
      this.inventoryRepository.getStockByBranch(branchId, { search, category, lowStockOnly, page: safePage, limit: safeLimit }),
      this.inventoryRepository.countStockByBranch(branchId, { search, category, lowStockOnly }),
    ]);
    return {
      items: InventoryResponseDto.fromEntityList(items),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getLowStockList(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const items = await this.inventoryRepository.getLowStock(branchId);
    return {
      items: InventoryResponseDto.fromEntityList(items),
      total: items.length,
    };
  }

  async getStockDetail(productId, branchId) {
    if (!productId) throw new ApiError(400, 'productId is required');
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const product = await this.inventoryRepository.getStockByProduct(productId, branchId);
    if (!product) throw new ApiError(404, 'Product not found in this branch');
    return InventoryResponseDto.fromEntity(product);
  }

  async adjustStock(productId, branchId, quantity, options = {}) {
    if (!productId) throw new ApiError(400, 'productId is required');
    if (!branchId) throw new ApiError(400, 'branchId is required');
    if (typeof quantity !== 'number') throw new ApiError(400, 'quantity must be a number');
    if (!Number.isFinite(quantity)) throw new ApiError(400, 'quantity must be finite');

    // Atomically update inside a transaction with a guard in the WHERE clause.
    // This avoids the read-modify-write race condition.
    const result = await this.inventoryRepository.adjustStock(productId, branchId, quantity, options);
    if (!result) {
      throw new ApiError(404, 'Product not found in this branch or stock would go negative');
    }
    return InventoryResponseDto.fromEntity(result);
  }

  async getStockSummary(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const summary = await this.inventoryRepository.getStockSummaryByCategory(branchId);
    const totalProducts = summary.reduce((sum, s) => sum + s.productCount, 0);
    const totalQuantity = summary.reduce((sum, s) => sum + s.totalQuantity, 0);
    const totalValue = summary.reduce((sum, s) => sum + s.totalValue, 0);
    return { summary, totalProducts, totalQuantity, totalValue };
  }

  // Tra cuu phu tung dang active theo chi nhanh - dung khi tao phieu quyet
  // toan sua chua (chon dong "Phu tung"). Fetch het roi loc khong-dau o day
  // (giong CatalogSearchService), vi catalog phu tung cung chi vai chuc dong.
  async searchProducts(term, branchId) {
    if (!term || term.trim().length < 2) {
      throw new ApiError(400, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }
    if (!branchId) throw new ApiError(400, 'Tài khoản chưa được gán chi nhánh');

    const needle = normalizeVietnamese(term.trim());
    const allProducts = await this.inventoryRepository.findAllActiveProducts(branchId);
    const matched = allProducts.filter(
      (p) =>
        normalizeVietnamese(p.productCode).includes(needle) ||
        normalizeVietnamese(p.productName).includes(needle)
    );
    return InventoryResponseDto.fromEntityList(matched.slice(0, 10));
  }

  // Thong ke phu tung duoc su dung nhieu nhat (Dashboard Tong quan kho).
  async getTopUsedPartsStats({ branchId, fromDate, toDate, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    return this.inventoryRepository.getTopUsedPartsStats(branchId, { fromDate, toDate, limit });
  }
}

module.exports = InventoryService;