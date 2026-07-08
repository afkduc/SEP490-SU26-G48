const ApiError = require('../../utils/ApiError');

class InventoryResponseDto {
  static fromEntity(product) {
    if (!product) return null;
    return {
      id: product.id,
      productCode: product.productCode,
      productName: product.productName,
      category: product.category,
      brandName: product.brandName,
      unit: product.unit,
      unitPrice: product.unitPrice,
      stockQuantity: product.stockQuantity,
      minStock: product.minStock,
      supplierId: product.supplierId,
      supplierName: product.supplierName,
      location: product.location,
      branchId: product.branchId,
      status: product.status,
      isLowStock: product.stockQuantity <= product.minStock,
      stockGap: product.stockQuantity - product.minStock,
    };
  }

  static fromEntityList(products) {
    return products.map((p) => InventoryResponseDto.fromEntity(p));
  }
}

class InventoryService {
  constructor({ inventoryRepository }) {
    this.inventoryRepository = inventoryRepository;
  }

  async getStockList({ branchId, search, category, lowStockOnly, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const [items, total] = await Promise.all([
      this.inventoryRepository.getStockByBranch(branchId, { search, category, lowStockOnly, page, limit }),
      this.inventoryRepository.countStockByBranch(branchId, { search, category, lowStockOnly }),
    ]);
    return {
      items: InventoryResponseDto.fromEntityList(items),
      total,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
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

  async adjustStock(productId, branchId, quantity) {
    if (!productId) throw new ApiError(400, 'productId is required');
    if (!branchId) throw new ApiError(400, 'branchId is required');
    if (typeof quantity !== 'number') throw new ApiError(400, 'quantity must be a number');

    const current = await this.inventoryRepository.getStockByProduct(productId, branchId);
    if (!current) throw new ApiError(404, 'Product not found in this branch');

    const newStock = current.stockQuantity + quantity;
    if (newStock < 0) {
      throw new ApiError(400, 'Stock cannot be negative');
    }

    const updated = await this.inventoryRepository.updateStock(productId, branchId, quantity);
    return InventoryResponseDto.fromEntity(updated);
  }

  async getStockSummary(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const summary = await this.inventoryRepository.getStockSummaryByCategory(branchId);
    const totalProducts = summary.reduce((sum, s) => sum + s.productCount, 0);
    const totalQuantity = summary.reduce((sum, s) => sum + s.totalQuantity, 0);
    const totalValue = summary.reduce((sum, s) => sum + s.totalValue, 0);
    return { summary, totalProducts, totalQuantity, totalValue };
  }
}

module.exports = { InventoryService, InventoryResponseDto };
