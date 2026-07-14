class VehicleOwner {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.vehicleId = data.vehicleId ?? null;
    this.customerId = data.customerId ?? null;
    this.customerName = data.customerName ?? null;
    this.customerPhone = data.customerPhone ?? null;
    this.startDate = data.startDate ?? null;
    this.endDate = data.endDate ?? null;
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt ?? null;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new VehicleOwner({
      id: row.id,
      vehicleId: row.vehicle_id,
      customerId: row.customer_id,
      customerName: row.customer_full_name,
      customerPhone: row.customer_phone,
      startDate: row.start_date,
      endDate: row.end_date,
      notes: row.notes,
      createdAt: row.created_at,
    });
  }
}

module.exports = VehicleOwner;
