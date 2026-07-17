/**
 * DTO cho response cua module Export Request.
 * Mapping tu ExportRequest / ExportRequestItem entity -> payload FE.
 */
class ExportRequestResponseDto {
  /**
   * Tu entity header + items -> response payload.
   * @param {Object} header - ExportRequest entity
   * @param {Array} items - ExportRequestItem[]
   */
  static fromEntity(header, items = []) {
    if (!header) return null;
    return {
      id: header.id,
      requestCode: header.requestCode,
      branchId: header.branchId,
      repairOrderId: header.repairOrderId,
      repairOrderCode: header.repairOrderCode,
      serviceOrderId: header.serviceOrderId,
      serviceOrderCode: header.serviceOrderCode,
      customerName: header.customerName,
      vehiclePlate: header.vehiclePlate,
      performedBy: header.performedBy,
      performedByName: header.performedByName,
      exportDate: this._formatDate(header.exportDate),
      status: header.status,
      notes: header.notes,
      createdAt: header.createdAt,
      itemCount: header.itemCount ?? items.length,
      totalQuantity: header.totalQuantity
        ?? items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
      items: items.map((it) => ExportRequestResponseDto.fromItemEntity(it)),
    };
  }

  static fromItemEntity(item) {
    if (!item) return null;
    return {
      id: item.id,
      exportRequestId: item.exportRequestId,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
    };
  }

  static fromEntityList(rows) {
    return rows.map((r) => ExportRequestResponseDto.fromEntity(r));
  }

  static _formatDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }
}

module.exports = ExportRequestResponseDto;