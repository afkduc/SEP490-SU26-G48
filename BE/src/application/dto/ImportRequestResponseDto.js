/**
 * DTO cho response cua module Import Request.
 * Mapping tu ImportRequest / ImportRequestItem entity -> payload FE.
 */
class ImportRequestResponseDto {
  /**
   * Tu entity header + items -> response payload.
   * @param {Object} header - ImportRequest entity (da co supplierName, items...)
   * @param {Array} items - ImportRequestItem[]
   */
  static fromEntity(header, items = []) {
    if (!header) return null;
    return {
      id: header.id,
      requestCode: header.requestCode,
      branchId: header.branchId,
      supplierId: header.supplierId,
      supplierName: header.supplierName,
      supplierInvoiceNo: header.supplierInvoiceNo,
      requestedBy: header.requestedBy,
      requestedByName: header.requestedByName,
      approvedBy: header.approvedBy,
      approvedByName: header.approvedByName,
      importDate: this._formatDate(header.importDate),
      status: header.status,
      rejectReason: header.rejectReason,
      notes: header.notes,
      createdAt: header.createdAt,
      itemCount: header.itemCount ?? items.length,
      totalQuantity: header.totalQuantity
        ?? items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
      items: items.map((it) => ImportRequestResponseDto.fromItemEntity(it)),
    };
  }

  static fromItemEntity(item) {
    if (!item) return null;
    return {
      id: item.id,
      importRequestId: item.importRequestId,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
    };
  }

  static fromEntityList(rows) {
    return rows.map((r) => ImportRequestResponseDto.fromEntity(r));
  }

  static _formatDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }
}

module.exports = ImportRequestResponseDto;