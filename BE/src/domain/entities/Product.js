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
    this.unitId = data.unit_id ?? data.unitId ?? null;
    this.unit = data.unit_name ?? data.unit ?? null;
    this.unitName = data.unit_name ?? data.unitName ?? null;
    this.unitPrice = data.unit_price ?? data.unitPrice ?? null;
    this.stockQuantity = data.stock_quantity ?? data.stockQuantity ?? 0;
    this.minStock = data.min_stock ?? data.minStock ?? 0;
    this.supplierId = data.supplier_id ?? data.supplierId ?? null;
    this.branchId = data.branch_id ?? data.branchId ?? null;
    this.status = data.status ?? 'active';
    this.note = data.note ?? null;
    this.createdByRole = data.created_by_role ?? data.createdByRole ?? null;
    this.seenByManagerAt = data.seen_by_manager_at ?? data.seenByManagerAt ?? null;
    // "Moi" doi voi Quan ly = do Nhan vien kho tao va Quan ly chua tung xem qua.
    this.isNewForManager = this.createdByRole === 'warehouse_staff' && !this.seenByManagerAt;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new Product({
      id: row.id,
      product_code: row.product_code,
      product_name: row.product_name,
      category: row.category,
      unit_id: row.unit_id,
      unit_name: row.unit_name,
      unit_price: row.unit_price,
      stock_quantity: row.stock_quantity,
      min_stock: row.min_stock,
      supplier_id: row.supplier_id,
      branch_id: row.branch_id,
      status: row.status,
      created_by_role: row.created_by_role,
      seen_by_manager_at: row.seen_by_manager_at,
    });
  }

  toPersistence() {
    return {
      id: this.id,
      product_code: this.productCode,
      product_name: this.productName,
      category: this.category,
      unit_id: this.unitId,
      unit_price: this.unitPrice,
      stock_quantity: this.stockQuantity,
      min_stock: this.minStock,
      supplier_id: this.supplierId,
      branch_id: this.branchId,
      status: this.status,
    };
  }

  isLowStock() {
    return this.stockQuantity <= this.minStock;
  }
}

module.exports = Product;
