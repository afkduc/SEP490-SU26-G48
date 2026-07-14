class Customer {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.customerCode = data.customerCode ?? null;
    this.fullName = data.fullName ?? null;
    this.phone = data.phone ?? null;
    this.email = data.email ?? null;
    this.cccd = data.cccd ?? null;
    this.dateOfBirth = data.dateOfBirth ?? null;
    this.address = data.address ?? null;
    this.taxCode = data.taxCode ?? null;
    this.contactName = data.contactName ?? null;
    this.contactPhone = data.contactPhone ?? null;
    this.createdAt = data.createdAt ?? null;
    this.vehicles = data.vehicles ?? []; // [{ id, licensePlate, vehicleModel, frameNumber, engineNumber, currentKm }]
    this.historyCount = data.historyCount ?? 0;
  }

  static fromPersistence(row, vehicleRows = [], historyCount = 0) {
    if (!row) return null;
    return new Customer({
      id: row.id,
      customerCode: row.customer_code,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      cccd: row.cccd,
      dateOfBirth: row.date_of_birth,
      address: row.address,
      taxCode: row.tax_code,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      createdAt: row.created_at,
      vehicles: vehicleRows.map((v) => ({
        id: v.id,
        licensePlate: v.license_plate,
        vehicleModel: v.vehicle_model_text,
        frameNumber: v.frame_number,
        engineNumber: v.engine_number,
        currentKm: v.current_km,
      })),
      historyCount,
    });
  }
}

module.exports = Customer;
