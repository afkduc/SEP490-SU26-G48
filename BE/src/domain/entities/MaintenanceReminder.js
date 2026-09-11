/**
 * MaintenanceReminder entity - tuong ung bang `maintenance_reminders`, tu dong
 * sinh 3 moc (1 tuan/1 thang/2 thang tinh tu ngay tao phieu) cho moi phieu
 * quyet toan (repair_orders), kem thong tin join tu vehicles/customers de
 * hien thi.
 */
class MaintenanceReminder {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.repairOrderId = data.repairOrderId ?? null;
    this.vehicleId = data.vehicleId ?? null;
    this.customerId = data.customerId ?? null;
    this.branchId = data.branchId ?? null;
    this.reminderType = data.reminderType ?? null;
    this.dueDate = data.dueDate ?? null;
    this.isSent = data.isSent ?? false;
    this.sentAt = data.sentAt ?? null;
    this.isConfirmed = data.isConfirmed ?? false;
    this.confirmedDate = data.confirmedDate ?? null;
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt ?? null;

    this.customer = data.customer ?? null; // { id, fullName, phone }
    this.vehicle = data.vehicle ?? null; // { id, licensePlate, vehicleModel, currentKm }
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new MaintenanceReminder({
      id: row.id,
      repairOrderId: row.repair_order_id,
      vehicleId: row.vehicle_id,
      customerId: row.customer_id,
      branchId: row.branch_id,
      reminderType: row.reminder_type,
      dueDate: row.due_date,
      isSent: Boolean(row.is_sent),
      sentAt: row.sent_at,
      isConfirmed: Boolean(row.is_confirmed),
      confirmedDate: row.confirmed_date,
      notes: row.notes,
      createdAt: row.created_at,
      customer: {
        id: row.customer_id,
        fullName: row.customer_full_name,
        phone: row.customer_phone,
      },
      vehicle: {
        id: row.vehicle_id,
        licensePlate: row.vehicle_license_plate,
        vehicleModel: row.vehicle_model_text,
        currentKm: row.vehicle_current_km,
      },
    });
  }
}

module.exports = MaintenanceReminder;
