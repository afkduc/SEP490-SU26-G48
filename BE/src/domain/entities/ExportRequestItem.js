/**
 * ExportRequestItem entity - tuong ung bang `export_request_items` trong SQL Server.
 * Snapshot product_code/product_name/unit tai thoi diem xuat,
 * tranh phu thuoc vao bang `products` sau nay (neu product doi ten).
 */
class ExportRequestItem {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.exportRequestId = data.export_request_id ?? data.exportRequestId ?? null;
    this.productId = data.product_id ?? data.productId ?? null;
    this.productCode = data.product_code ?? data.productCode ?? null;
    this.productName = data.product_name ?? data.productName ?? null;
    this.unit = data.unit ?? null;
    this.quantity = data.quantity ?? 0;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new ExportRequestItem({
      id: row.id,
      export_request_id: row.export_request_id,
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
      export_request_id: this.exportRequestId,
      product_id: this.productId,
      product_code: this.productCode,
      product_name: this.productName,
      unit: this.unit,
      quantity: this.quantity,
    };
  }
}

module.exports = ExportRequestItem;