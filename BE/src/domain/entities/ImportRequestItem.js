/**
 * ImportRequestItem entity – tuong ung bang `import_request_items` trong SQL Server.
 * Snapshot product_code/product_name/unit tai thoi diem nhap,
 * tranh phu thuoc vao bang `products` sau nay (neu product doi ten).
 */
class ImportRequestItem {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.importRequestId = data.import_request_id ?? data.importRequestId ?? null;
    this.productId = data.product_id ?? data.productId ?? null;
    this.productCode = data.product_code ?? data.productCode ?? null;
    this.productName = data.product_name ?? data.productName ?? null;
    this.unit = data.unit ?? null;
    this.quantity = data.quantity ?? 0;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new ImportRequestItem({
      id: row.id,
      import_request_id: row.import_request_id,
      product_id: row.product_id,
      product_code: row.product_code,
      product_name: row.product_name,
      unit: row.unit,
      quantity: row.quantity,
    });
  }

  toPersistence() {
    return {
      id: this.id,
      import_request_id: this.importRequestId,
      product_id: this.productId,
      product_code: this.productCode,
      product_name: this.productName,
      unit: this.unit,
      quantity: this.quantity,
    };
  }
}

module.exports = ImportRequestItem;