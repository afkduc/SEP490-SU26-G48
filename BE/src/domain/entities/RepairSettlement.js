/**
 * RepairSettlement entity - tuong ung bang `repair_orders` (header)
 * + `repair_order_items` (danh sach hang muc/phu tung), kem thong tin
 * join tu customers/vehicles/users de tra ve du du lieu cho phieu.
 */
class RepairSettlement {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.code = data.code ?? null;
    this.branchId = data.branchId ?? null;
    this.branchName = data.branchName ?? null;
    this.customerId = data.customerId ?? null;
    this.vehicleId = data.vehicleId ?? null;
    this.advisorId = data.advisorId ?? null;
    this.teamLeaderId = data.teamLeaderId ?? null;
    this.teamLeaderName = data.teamLeaderName ?? null;
    // Truoc khi gop bang, day la id cua dong trong bang lenh sua chua RIENG
    // (null neu chua gan to truong). Sau khi gop, lenh sua chua CHINH LA phieu
    // nay nen gia tri bang chinh `id` - van giu null khi chua ai nhan viec de
    // FE khong phai doi: no dang dung truong nay dung theo nghia "da co lenh
    // sua chua chua?" (xem RepairSettlementPage.jsx).
    this.repairOrderId = data.repairOrderId ?? null;
    // So khoang xe dang sua phieu nay (vehicle_bays.bay_number qua
    // repair_orders.bay_id) - null neu chua gan to truong/khoang.
    this.bayNumber = data.bayNumber ?? null;
    // Da co it nhat 1 dau muc cua lenh sua chua nay duoc tick hoan thanh -
    // dung de khoa nut "Huy" o man danh sach khi dang "inprogress" (xem
    // RepairSettlementService.updateStatus).
    this.hasCompletedTask = data.hasCompletedTask ?? false;
    // Da gan tho thuc hien chua - xem HEADER_SELECT/FE displayStatus().
    this.hasTechnicians = data.hasTechnicians ?? false;
    this.customerRequest = data.customerRequest ?? null;
    this.currentKm = data.currentKm ?? null;
    this.status = data.status ?? 'waiting_repair';
    this.subtotal = data.subtotal ?? 0;
    this.discountAmount = data.discountAmount ?? 0;
    this.afterDiscount = data.afterDiscount ?? 0;
    this.vat = data.vat ?? 0;
    this.freeAmount = data.freeAmount ?? 0;
    this.total = data.total ?? 0;
    this.isWarranty = data.isWarranty ?? false;
    this.intakeDate = data.intakeDate ?? null;
    this.completedDate = data.completedDate ?? null;
    this.deliveryDate = data.deliveryDate ?? null;
    this.paidAt = data.paidAt ?? null;
    // 'TRANSFER' (PayOS) | 'CASH' (CVDV xac nhan tay) - null neu chua thanh toan.
    this.paymentMethod = data.paymentMethod ?? null;
    this.cancelReason = data.cancelReason ?? null;
    this.cancelledAt = data.cancelledAt ?? null;
    // Phieu tiep nhan va ban giao xe (kiem tra noi that/ngoai that/khoang dong
    // co...) - luu nguyen 1 khoi JSON, xem shape trong IntakeChecklistSection.jsx.
    this.intakeChecklist = data.intakeChecklist ?? null;
    this.note = data.note ?? null;
    // Chu ky dien tu tai cho (nguoi lien he ky truc tiep khi tao phieu) - xem
    // RepairSettlementService._assertSignaturePresent.
    this.signatureData = data.signatureData ?? null;
    this.signerName = data.signerName ?? null;
    this.signedAt = data.signedAt ?? null;
    // CVDV dang mo phieu nay (man Phieu quyet toan sua chua) - null neu khong
    // ai dang mo hoac khoa da het han (xem RepairSettlementRepositoryImpl
    // HEADER_SELECT, da loc TTL san trong SQL nen o day luon la "con hieu luc").
    this.lockedBy = data.lockedBy ?? null; // { id, name }
    this.lockedAt = data.lockedAt ?? null;

    this.customer = data.customer ?? null; // { id, fullName, phone, address, taxCode, cccd, email, contactPerson, contactPhone }
    this.vehicle = data.vehicle ?? null; // { id, licensePlate, vehicleModel, frameNumber, engineNumber, purchaseDate, currentKm }
    this.advisor = data.advisor ?? null; // { id, name, phone }
    this.items = data.items ?? []; // [{ id, code, serviceId, description, lhsc, httt, repairCategory, unit, qty, unitPrice, discount, isFree, total }]
    // Chi co du lieu khi phieu da duoc gan to truong (co repair_order) - dung
    // de co van xem tien do tung dau viec To truong da tich (xem [{ id, taskName, taskType, isDone }]).
    this.tasks = data.tasks ?? [];
    // Tho thuc hien lenh sua chua (repair_order_technicians, co the nhieu tho) -
    // chi co khi da gan to truong, xem [{ id, fullName, phone }].
    this.technicians = data.technicians ?? [];
  }

  static fromPersistence(headerRow, itemRows = [], taskRows = [], technicianRows = []) {
    if (!headerRow) return null;
    return new RepairSettlement({
      id: headerRow.id,
      code: headerRow.repair_code,
      branchId: headerRow.branch_id,
      branchName: headerRow.branch_name,
      customerId: headerRow.customer_id,
      vehicleId: headerRow.vehicle_id,
      advisorId: headerRow.advisor_id,
      teamLeaderId: headerRow.team_leader_id,
      teamLeaderName: headerRow.team_leader_name,
      repairOrderId: headerRow.repair_started_at ? headerRow.id : null,
      bayNumber: headerRow.bay_number,
      hasCompletedTask: Boolean(headerRow.has_completed_task),
      hasTechnicians: Boolean(headerRow.has_technicians),
      customerRequest: headerRow.customer_request,
      currentKm: headerRow.current_km,
      status: headerRow.status,
      subtotal: headerRow.subtotal,
      discountAmount: headerRow.discount_amount,
      afterDiscount: headerRow.after_discount,
      vat: headerRow.vat,
      freeAmount: headerRow.free_amount,
      total: headerRow.total,
      isWarranty: Boolean(headerRow.is_warranty),
      intakeDate: headerRow.intake_date,
      completedDate: headerRow.completed_date,
      deliveryDate: headerRow.delivery_date,
      paidAt: headerRow.invoice_issued_at,
      paymentMethod: headerRow.payment_method ?? null,
      cancelReason: headerRow.cancel_reason,
      cancelledAt: headerRow.cancelled_at,
      intakeChecklist: headerRow.intake_checklist ? JSON.parse(headerRow.intake_checklist) : null,
      note: headerRow.note ?? null,
      signatureData: headerRow.signature_data ?? null,
      signerName: headerRow.signature_signer_name ?? null,
      signedAt: headerRow.signature_signed_at ?? null,
      lockedBy: headerRow.active_locked_by_user_id
        ? { id: headerRow.active_locked_by_user_id, name: headerRow.active_locked_by_name }
        : null,
      lockedAt: headerRow.active_locked_at ?? null,
      customer: {
        id: headerRow.customer_id,
        fullName: headerRow.customer_full_name,
        phone: headerRow.customer_phone,
        address: headerRow.customer_address,
        taxCode: headerRow.customer_tax_code,
        cccd: headerRow.customer_cccd,
        email: headerRow.customer_email,
        contactPerson: headerRow.customer_contact_name,
        contactPhone: headerRow.customer_contact_phone,
      },
      vehicle: {
        id: headerRow.vehicle_id,
        licensePlate: headerRow.vehicle_license_plate,
        vehicleModel: headerRow.vehicle_model_text,
        frameNumber: headerRow.vehicle_frame_number,
        engineNumber: headerRow.vehicle_engine_number,
        purchaseDate: headerRow.vehicle_purchase_date,
        currentKm: headerRow.vehicle_current_km,
      },
      advisor: {
        id: headerRow.advisor_id,
        name: headerRow.advisor_name,
        phone: headerRow.advisor_phone,
      },
      items: itemRows.map((r) => ({
        id: r.id,
        code: r.item_code,
        serviceId: r.service_id,
        productId: r.product_id,
        description: r.item_description,
        lhsc: r.lhsc,
        httt: r.httt,
        repairCategory: r.repair_category,
        unit: r.unit,
        qty: r.quantity,
        unitPrice: r.unit_price,
        discount: r.discount_pct,
        isFree: Boolean(r.is_free),
        total: r.total,
        note: r.note ?? null,
      })),
      tasks: taskRows.map((r) => ({
        id: r.id,
        taskName: r.task_name,
        taskType: r.task_type,
        quantity: r.quantity,
        isDone: Boolean(r.is_done),
        isCancelled: Boolean(r.is_cancelled),
        isAddedLater: Boolean(r.is_added_later),
        isQtyIncreased: Boolean(r.is_qty_increased),
        prevQuantity: r.prev_quantity ?? null,
        note: r.note ?? null,
      })),
      technicians: technicianRows.map((r) => ({
        id: r.id,
        fullName: r.user_name,
        phone: r.phone,
        sameTeam: Boolean(r.same_team),
      })),
    });
  }
}

module.exports = RepairSettlement;
