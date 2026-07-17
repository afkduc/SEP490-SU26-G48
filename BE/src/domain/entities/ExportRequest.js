/**
 * ExportRequest entity - tuong ung bang `export_requests` trong SQL Server.
 * Dung cho module Kho / Phieu xuat.
 *
 * Luu y: khac voi ImportRequest, phieu xuat KHONG can duyet - NVKho xuat truc tiep
 * theo Service Order (phieu sua chua). Trang thai don gian:
 *   completed - xuat xong (default), ton kho da bi tru
 *   cancelled - huy (phase sau, neu can)
 */
class ExportRequest {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.requestCode = data.request_code ?? data.requestCode ?? null;
    this.branchId = data.branch_id ?? data.branchId ?? null;
    this.repairOrderId = data.repair_order_id ?? data.repairOrderId ?? null;
    this.serviceOrderId = data.service_order_id ?? data.serviceOrderId ?? null;
    this.performedBy = data.performed_by ?? data.performedBy ?? null;
    this.exportDate = data.export_date ?? data.exportDate ?? null;
    this.status = data.status ?? 'completed';
    this.notes = data.notes ?? null;
    this.createdAt = data.created_at ?? data.createdAt ?? null;
    // Thong tin mo rong (join)
    this.items = data.items ?? null;
    this.repairOrderCode = data.repair_order_code ?? data.repairOrderCode ?? null;
    this.serviceOrderCode = data.service_order_code ?? data.serviceOrderCode ?? null;
    this.customerName = data.customer_name ?? data.customerName ?? null;
    this.vehiclePlate = data.vehicle_plate ?? data.vehiclePlate ?? null;
    this.performedByName = data.performed_by_name ?? data.performedByName ?? null;
    this.totalQuantity = data.total_quantity ?? data.totalQuantity ?? null;
    this.itemCount = data.item_count ?? data.itemCount ?? null;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new ExportRequest({
      id: row.id,
      request_code: row.request_code,
      branch_id: row.branch_id,
      repair_order_id: row.repair_order_id,
      service_order_id: row.service_order_id,
      performed_by: row.performed_by,
      export_date: row.export_date,
      status: row.status,
      notes: row.notes,
      created_at: row.created_at,
      repair_order_code: row.repair_order_code,
      service_order_code: row.service_order_code,
      customer_name: row.customer_name,
      vehicle_plate: row.vehicle_plate,
      performed_by_name: row.performed_by_name,
      total_quantity: row.total_quantity,
      item_count: row.item_count,
    });
  }

  toPersistence() {
    return {
      id: this.id,
      request_code: this.requestCode,
      branch_id: this.branchId,
      repair_order_id: this.repairOrderId,
      performed_by: this.performedBy,
      export_date: this.exportDate,
      status: this.status,
      notes: this.notes,
      created_at: this.createdAt,
    };
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isCancelled() {
    return this.status === 'cancelled';
  }
}

module.exports = ExportRequest;