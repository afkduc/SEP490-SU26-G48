/**
 * RepairOrder entity - tuong ung bang `repair_orders` (header) + `repair_order_tasks`
 * (danh sach cong viec sao chep tu service_order_items cua phieu quyet toan goc),
 * kem thong tin join tu branches/users/vehicles/customers de tra ve du du lieu.
 */
class RepairOrder {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.code = data.code ?? null;
    this.serviceOrderId = data.serviceOrderId ?? null;
    this.branchId = data.branchId ?? null;
    this.branchName = data.branchName ?? null;
    this.teamLeaderId = data.teamLeaderId ?? null;
    this.teamLeaderName = data.teamLeaderName ?? null;
    this.teamLeaderSpecialty = data.teamLeaderSpecialty ?? null;
    this.vehicleId = data.vehicleId ?? null;
    this.createdBy = data.createdBy ?? null;
    this.createdByName = data.createdByName ?? null;
    this.status = data.status ?? 'inprogress';
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt ?? null;
    this.completedAt = data.completedAt ?? null;

    this.customer = data.customer ?? null; // { id, fullName }
    this.vehicle = data.vehicle ?? null; // { id, licensePlate, vehicleModel }
    this.tasks = data.tasks ?? []; // [{ id, taskName, taskType, productId, quantity, unitPrice, isDone }]
  }

  static fromPersistence(headerRow, taskRows = []) {
    if (!headerRow) return null;
    return new RepairOrder({
      id: headerRow.id,
      code: headerRow.repair_code,
      serviceOrderId: headerRow.service_order_id,
      branchId: headerRow.branch_id,
      branchName: headerRow.branch_name,
      teamLeaderId: headerRow.team_leader_id,
      teamLeaderName: headerRow.team_leader_name,
      teamLeaderSpecialty: headerRow.team_leader_specialty,
      vehicleId: headerRow.vehicle_id,
      createdBy: headerRow.created_by,
      createdByName: headerRow.created_by_name,
      status: headerRow.status,
      notes: headerRow.notes,
      createdAt: headerRow.created_at,
      completedAt: headerRow.completed_at,
      customer: {
        id: headerRow.customer_id,
        fullName: headerRow.customer_full_name,
      },
      vehicle: {
        id: headerRow.vehicle_id,
        licensePlate: headerRow.vehicle_license_plate,
        vehicleModel: headerRow.vehicle_model_text,
      },
      tasks: taskRows.map((r) => ({
        id: r.id,
        taskName: r.task_name,
        taskType: r.task_type,
        productId: r.product_id,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        isDone: Boolean(r.is_done),
      })),
    });
  }
}

module.exports = RepairOrder;
