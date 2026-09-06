/**
 * RepairOrder entity - tuong ung bang `repair_orders` (header) + `repair_order_tasks`
 * (danh sach cong viec sao chep tu repair_order_items cua phieu quyet toan goc),
 * kem thong tin join tu branches/users/vehicles/customers de tra ve du du lieu.
 */
class RepairOrder {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.code = data.code ?? null;
    this.branchId = data.branchId ?? null;
    this.branchName = data.branchName ?? null;
    this.teamLeaderId = data.teamLeaderId ?? null;
    this.teamLeaderName = data.teamLeaderName ?? null;
    this.teamLeaderSpecialty = data.teamLeaderSpecialty ?? null;
    this.bayId = data.bayId ?? null;
    this.bayNumber = data.bayNumber ?? null;
    this.vehicleId = data.vehicleId ?? null;
    this.createdBy = data.createdBy ?? null;
    this.createdByName = data.createdByName ?? null;
    this.advisorId = data.advisorId ?? null; // co van dich vu phu trach phieu (repair_orders.advisor_id)
    this.advisorName = data.advisorName ?? null;
    this.intakeChecklist = data.intakeChecklist ?? null; // "Tiep nhan va ban giao xe" - ro.intake_checklist
    this.status = data.status ?? 'inprogress'; // suy ra, khong phai cot DB
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt ?? null;
    this.completedAt = data.completedAt ?? null;
    // Moc khoang xe bam "Hoan thanh" - to truong chua xac nhan thi lenh
    // van dang chay (status = 'awaiting_confirmation').
    this.bayCompletedAt = data.bayCompletedAt ?? null;
    this.cancelReason = data.cancelReason ?? null;

    this.customer = data.customer ?? null; // { id, fullName }
    this.vehicle = data.vehicle ?? null; // { id, licensePlate, vehicleModel }
    this.tasks = data.tasks ?? []; // [{ id, taskName, taskType, productId, quantity, unitPrice, isDone }]
    this.technicians = data.technicians ?? []; // [{ id, fullName, phone }] - repair_order_technicians (nhieu tho cung sua 1 xe)
  }

  static fromPersistence(headerRow, taskRows = [], technicianRows = []) {
    if (!headerRow) return null;
    return new RepairOrder({
      id: headerRow.id,
      code: headerRow.repair_code,
      branchId: headerRow.branch_id,
      branchName: headerRow.branch_name,
      teamLeaderId: headerRow.team_leader_id,
      teamLeaderName: headerRow.team_leader_name,
      teamLeaderSpecialty: headerRow.team_leader_specialty,
      bayId: headerRow.bay_id,
      bayNumber: headerRow.vb_bay_number,
      vehicleId: headerRow.vehicle_id,
      createdBy: headerRow.repair_created_by,
      createdByName: headerRow.created_by_name,
      advisorId: headerRow.advisor_id,
      advisorName: headerRow.advisor_name,
      intakeChecklist: headerRow.intake_checklist ? JSON.parse(headerRow.intake_checklist) : null,
      status: headerRow.repair_status,
      notes: headerRow.repair_notes,
      createdAt: headerRow.repair_started_at,
      completedAt: headerRow.repair_completed_at,
      bayCompletedAt: headerRow.bay_completed_at,
      cancelReason: headerRow.cancel_reason,
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
        isCancelled: Boolean(r.is_cancelled),
        isAddedLater: Boolean(r.is_added_later),
        isQtyIncreased: Boolean(r.is_qty_increased),
        prevQuantity: r.prev_quantity ?? null,
        note: r.note ?? null,
        // Bieu mau "Phieu kiem tra BDDK": yeu cau thuc hien (I/R/M/V), nhom
        // cong viec, va ket qua kiem tra OK/NG + mo ta khi NG.
        actionCode: r.action_code ?? null,
        checklistGroup: r.checklist_group ?? null,
        checklistOrder: r.checklist_order ?? null,
        checkResult: r.check_result ?? null,
        checkNote: r.check_note ?? null,
      })),
      technicians: technicianRows.map((r) => ({
        id: r.id,
        fullName: r.user_name,
        phone: r.phone,
        sameTeam: String(r.team_leader_id) === String(headerRow.team_leader_id),
      })),
    });
  }
}

module.exports = RepairOrder;
