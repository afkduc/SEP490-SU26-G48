/**
 * DTO cho response cua Supplier.
 * Mapping tu Supplier entity -> response an toan cho FE.
 */
class SupplierResponseDto {
  static fromEntity(supplier) {
    if (!supplier) return null;
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

  static fromEntityList(suppliers) {
    return suppliers.map((s) => SupplierResponseDto.fromEntity(s));
  }
}

module.exports = SupplierResponseDto;