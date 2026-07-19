/**
 * DTO cho response cua module Inventory.
 * Mapping tu Product entity -> response an toan (khong leak field noi bo).
 */
class InventoryResponseDto {
  /**
   * Tu mot Product entity (co stock_quantity, min_stock, supplierName...)
   * tra ve payload response cho FE.
   * @param {Object} product - Product entity hoac plain object co cac field can thiet
   */
  static fromEntity(product) {
    if (!product) return null;
    const stock = Number(product.stockQuantity ?? 0);
    const min = Number(product.minStock ?? 0);
    return {
      id: product.id,
      productCode: product.productCode,
      productName: product.productName,
      category: product.category,
      brandName: product.brandName,
      unitId: product.unitId,
      unitName: product.unitName,
      unitPrice: product.unitPrice,
      stockQuantity: stock,
      minStock: min,
      supplierId: product.supplierId,
      supplierName: product.supplierName,
      location: product.location,
      branchId: product.branchId,
      status: product.status,
      isLowStock: stock <= min,
      stockGap: stock - min,
    };
  }

  static fromEntityList(products) {
    return products.map((p) => InventoryResponseDto.fromEntity(p));
  }
}

module.exports = InventoryResponseDto;