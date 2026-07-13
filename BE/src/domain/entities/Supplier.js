/**
 * Supplier entity - tuong ung bang `suppliers` trong SQL Server.
 * Dung cho module Kho / Nha cung cap.
 */
class Supplier {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.supplierCode = data.supplier_code ?? data.supplierCode ?? null;
    this.supplierName = data.supplier_name ?? data.supplierName ?? null;
    this.contactName = data.contact_name ?? data.contactName ?? null;
    this.phone = data.phone ?? null;
    this.email = data.email ?? null;
    this.address = data.address ?? null;
    this.taxCode = data.tax_code ?? data.taxCode ?? null;
    this.status = data.status ?? 'active';
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new Supplier({
      id: row.id,
      supplier_code: row.supplier_code,
      supplier_name: row.supplier_name,
      contact_name: row.contact_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      tax_code: row.tax_code,
      status: row.status,
    });
  }
}

module.exports = Supplier;