// dd/mm/yyyy hh:mm - dung getter UTC vi mssql (useUTC mac dinh true) doc cot
// datetime theo truc UTC cua JS Date, khong lien quan mui gio may chu.
function toDDMMYYYYHHmm(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()} ${hh}:${min}`;
}

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
      customerName: header.customerName,
      vehiclePlate: header.vehiclePlate,
      performedBy: header.performedBy,
      performedByName: header.performedByName,
      receivedBy: header.receivedBy,
      receivedByName: header.receivedByName,
      receivedSignatureData: header.receivedSignatureData,
      receivedSignedAt: toDDMMYYYYHHmm(header.receivedSignedAt),
      exportDate: this._formatDate(header.exportDate),
      status: header.status,
      notes: header.notes,
      createdAt: header.createdAt,
      itemCount: header.itemCount ?? items.length,
      totalQuantity: header.totalQuantity
        ?? items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
      isNewForManager: !!header.isNewForManager,
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