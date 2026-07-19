/**
 * Product entity – tuong ung bang `products` trong SQL Server.
 * Dung cho module Kho / Phu tung.
 */
class Product {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.productCode = data.product_code ?? data.productCode ?? null;
    this.productName = data.product_name ?? data.productName ?? null;
    this.category = data.category ?? null;
    this.brandName = data.brand_name ?? data.brandName ?? null;
    this.unitId = data.unit_id ?? data.unitId ?? null;
    this.unitName = data.unit_name ?? data.unitName ?? null;
    this.unitPrice = data.unit_price ?? data.unitPrice ?? null;
    this.stockQuantity = data.stock_quantity ?? data.stockQuantity ?? 0;
    this.minStock = data.min_stock ?? data.minStock ?? 0;
    this.supplierId = data.supplier_id ?? data.supplierId ?? null;
    this.location = data.location ?? null;
    this.branchId = data.branch_id ?? data.branchId ?? null;
    this.status = data.status ?? 'active';
    this.note = data.note ?? null;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new Product({
      id: row.id,
      product_code: row.product_code,
      product_name: row.product_name,
      category: row.category,
      brand_name: row.brand_name,
      unit_id: row.unit_id,
      unit_name: row.unit_name,
      unit_price: row.unit_price,
      stock_quantity: row.stock_quantity,
      min_stock: row.min_stock,
      supplier_id: row.supplier_id,
      location: row.location,
      branch_id: row.branch_id,
      status: row.status,
    });
  }

  toPersistence() {
    return {
      id: this.id,
      product_code: this.productCode,
      product_name: this.productName,
      category: this.category,
      brand_name: this.brandName,
      unit_id: this.unitId,
      unit_price: this.unitPrice,
      stock_quantity: this.stockQuantity,
      min_stock: this.minStock,
      supplier_id: this.supplierId,
      location: this.location,
      branch_id: this.branchId,
      status: this.status,
    };
  }

  isLowStock() {
    return this.stockQuantity <= this.minStock;
  }
}

module.exports = Product;
