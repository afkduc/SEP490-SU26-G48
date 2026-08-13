/**
 * ImportRequest entity – tuong ung bang `import_requests` trong SQL Server.
 * Dung cho module Kho / Phieu nhap.
 *
 * Trang thai:
 *   pending  - moi tao, cho duyet
 *   approved - da duyet, da cong ton kho + ghi inventory_transactions
 *   rejected - bi tu choi (co reject_reason)
 */
class ImportRequest {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.requestCode = data.request_code ?? data.requestCode ?? null;
    this.branchId = data.branch_id ?? data.branchId ?? null;
    this.supplierId = data.supplier_id ?? data.supplierId ?? null;
    this.supplierInvoiceNo = data.supplier_invoice_no ?? data.supplierInvoiceNo ?? null;
    this.requestedBy = data.requested_by ?? data.requestedBy ?? null;
    this.approvedBy = data.approved_by ?? data.approvedBy ?? null;
    this.importDate = data.import_date ?? data.importDate ?? null;
    this.status = data.status ?? 'pending';
    this.rejectReason = data.reject_reason ?? data.rejectReason ?? null;
    this.notes = data.notes ?? null;
    this.createdAt = data.created_at ?? data.createdAt ?? null;
    // Thong tin mo rong (join) - co the null khi persistence
    this.items = data.items ?? null;
    this.supplierName = data.supplier_name ?? data.supplierName ?? null;
    this.requestedByName = data.requested_by_name ?? data.requestedByName ?? null;
    this.approvedByName = data.approved_by_name ?? data.approvedByName ?? null;
    this.totalQuantity = data.total_quantity ?? data.totalQuantity ?? null;
    this.itemCount = data.item_count ?? data.itemCount ?? null;
    this.seenByManagerAt = data.seen_by_manager_at ?? data.seenByManagerAt ?? null;
    this.isNewForManager = !this.seenByManagerAt;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new ImportRequest({
      id: row.id,
      request_code: row.request_code,
      branch_id: row.branch_id,
      supplier_id: row.supplier_id,
      supplier_invoice_no: row.supplier_invoice_no,
      requested_by: row.requested_by,
      approved_by: row.approved_by,
      import_date: row.import_date,
      status: row.status,
      reject_reason: row.reject_reason,
      notes: row.notes,
      created_at: row.created_at,
      supplier_name: row.supplier_name,
      requested_by_name: row.requested_by_name,
      approved_by_name: row.approved_by_name,
      total_quantity: row.total_quantity,
      item_count: row.item_count,
      seen_by_manager_at: row.seen_by_manager_at,
    });
  }

  toPersistence() {
    return {
      id: this.id,
      request_code: this.requestCode,
      branch_id: this.branchId,
      supplier_id: this.supplierId,
      supplier_invoice_no: this.supplierInvoiceNo,
      requested_by: this.requestedBy,
      approved_by: this.approvedBy,
      import_date: this.importDate,
      status: this.status,
      reject_reason: this.rejectReason,
      notes: this.notes,
      created_at: this.createdAt,
    };
  }

  isPending() {
    return this.status === 'pending';
  }

  isApproved() {
    return this.status === 'approved';
  }

  isRejected() {
    return this.status === 'rejected';
  }
}

module.exports = ImportRequest;