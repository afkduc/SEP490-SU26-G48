/**
 * ProductResponseDto – map BE entity → FE response format.
 * FE mock dung camelCase nen ta se tra ve camelCase.
 */
class ProductResponseDto {
  static fromEntity(product) {
    if (!product) return null;
    return {
      id: product.id,
      productCode: product.productCode,
      productName: product.productName,
      category: product.category,
      brandName: product.brandName,
      unitId: product.unitId,
      unitName: product.unitName,
      unitPrice: product.unitPrice,
      stockQuantity: product.stockQuantity,
      minStock: product.minStock,
      supplierId: product.supplierId,
      supplierName: product.supplierName,
      location: product.location,
      branchId: product.branchId,
      status: product.status,
      isLowStock: product.isLowStock ? product.isLowStock() : product.stockQuantity <= product.minStock,
    };
  }

  static fromEntityList(products) {
    return products.map((p) => ProductResponseDto.fromEntity(p));
  }
}

module.exports = ProductResponseDto;
