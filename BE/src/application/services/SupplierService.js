/**
 * SupplierService – read-only (chi list va xem chi tiet).
 * CRUD se duoc xu ly o module Admin neu can them/sua/xoa nha cung cap.
 */
class SupplierService {
  constructor({ supplierRepository }) {
    this.supplierRepository = supplierRepository;
  }

  async getSuppliers({ search, status } = {}) {
    const items = await this.supplierRepository.findAll({ search, status });
    return {
      items: items.map((s) => ({
        id: s.id,
        supplierCode: s.supplierCode,
        supplierName: s.supplierName,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        status: s.status,
      })),
      total: items.length,
    };
  }

  async getSupplierById(id) {
    const supplier = await this.supplierRepository.findById(id);
    if (!supplier) {
      const err = new Error('Supplier not found');
      err.status = 404;
      throw err;
    }
    return {
      id: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      taxCode: supplier.taxCode,
      status: supplier.status,
    };
  }
}

module.exports = SupplierService;