/**
 * RepairSettlement entity - tuong ung bang `service_orders` (header)
 * + `service_order_items` (danh sach hang muc/phu tung), kem thong tin
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
    this.customerRequest = data.customerRequest ?? null;
    this.currentKm = data.currentKm ?? null;
    this.status = data.status ?? 'waiting_repair';
    this.subtotal = data.subtotal ?? 0;
    this.discountAmount = data.discountAmount ?? 0;
    this.afterDiscount = data.afterDiscount ?? 0;
    this.vat = data.vat ?? 0;
    this.freeAmount = data.freeAmount ?? 0;
    this.total = data.total ?? 0;
    this.nextMaintenanceKm = data.nextMaintenanceKm ?? null;
    this.nextMaintenanceDate = data.nextMaintenanceDate ?? null;
    this.isWarranty = data.isWarranty ?? false;
    this.intakeDate = data.intakeDate ?? null;
    this.completedDate = data.completedDate ?? null;
    this.deliveryDate = data.deliveryDate ?? null;
    this.cancelReason = data.cancelReason ?? null;

    this.customer = data.customer ?? null; // { id, fullName, phone, address, taxCode, cccd, email, contactPerson, contactPhone }
    this.vehicle = data.vehicle ?? null; // { id, licensePlate, vehicleModel, frameNumber, engineNumber, purchaseDate, currentKm }
    this.advisor = data.advisor ?? null; // { id, name, phone }
    this.items = data.items ?? []; // [{ id, code, serviceId, description, lhsc, httt, unit, qty, unitPrice, discount, isFree, total }]
  }

  static fromPersistence(headerRow, itemRows = []) {
    if (!headerRow) return null;
    return new RepairSettlement({
      id: headerRow.id,
      code: headerRow.order_code,
      branchId: headerRow.branch_id,
      branchName: headerRow.branch_name,
      customerId: headerRow.customer_id,
      vehicleId: headerRow.vehicle_id,
      advisorId: headerRow.advisor_id,
      teamLeaderId: headerRow.team_leader_id,
      teamLeaderName: headerRow.team_leader_name,
      customerRequest: headerRow.customer_request,
      currentKm: headerRow.current_km,
      status: headerRow.status,
      subtotal: headerRow.subtotal,
      discountAmount: headerRow.discount_amount,
      afterDiscount: headerRow.after_discount,
      vat: headerRow.vat,
      freeAmount: headerRow.free_amount,
      total: headerRow.total,
      nextMaintenanceKm: headerRow.next_maintenance_km,
      nextMaintenanceDate: headerRow.next_maintenance_date,
      isWarranty: Boolean(headerRow.is_warranty),
      intakeDate: headerRow.intake_date,
      completedDate: headerRow.completed_date,
      deliveryDate: headerRow.delivery_date,
      cancelReason: headerRow.cancel_reason,
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
        unit: r.unit,
        qty: r.quantity,
        unitPrice: r.unit_price,
        discount: r.discount_pct,
        isFree: Boolean(r.is_free),
        total: r.total,
      })),
    });
  }
}

module.exports = RepairSettlement;
