/**
 * Chuan hoa snapshot audit cho cac loai phieu (de FE hien thi day du, de doc).
 */

function settlementSnapshot(item, extra = {}) {
  if (!item) return { ...extra };
  return {
    code: item.code || null,
    status: item.status || null,
    customerName: item.customer?.fullName || item.customerName || null,
    customerPhone: item.customer?.phone || item.customerPhone || null,
    licensePlate: item.vehicle?.licensePlate || item.licensePlate || null,
    vehicleModel: item.vehicle?.vehicleModel || item.vehicleModel || null,
    currentKm: item.currentKm ?? item.vehicle?.currentKm ?? null,
    customerRequest: item.customerRequest || null,
    notes: item.notes || item.note || null,
    subtotal: item.subtotal ?? null,
    vat: item.vat ?? null,
    total: item.total ?? item.totalAmount ?? null,
    signerName: item.signerName || null,
    hasSignature: Boolean(item.signatureData || item.hasSignature || item.signerName),
    items: item.items || [],
    ...extra,
  };
}

function exportRequestSnapshot(created) {
  if (!created) return {};
  return {
    requestCode: created.requestCode || null,
    status: created.status || null,
    repairOrderId: created.repairOrderId || null,
    repairOrderCode: created.repairOrderCode || null,
    serviceOrderCode: created.serviceOrderCode || null,
    customerName: created.customerName || null,
    vehiclePlate: created.vehiclePlate || null,
    exportDate: created.exportDate || null,
    notes: created.notes || null,
    performedByName: created.performedByName || null,
    itemCount: created.itemCount ?? (created.items || []).length,
    totalQuantity: created.totalQuantity ?? null,
    items: (created.items || []).map((it, index) => ({
      code: it.productCode || it.code || null,
      description: it.productName || it.description || it.name || `Hạng mục ${index + 1}`,
      name: it.productName || it.name || null,
      qty: it.quantity != null ? it.quantity : it.qty,
      unit: it.unit || null,
    })),
  };
}

function repairOrderSnapshot(item, extra = {}) {
  if (!item) return { ...extra };
  const techs = item.technicians || [];
  return {
    code: item.code || null,
    status: item.status || null,
    bayId: item.bayId || null,
    bayNumber: item.bayNumber || null,
    technicians: techs,
    technicianNames: techs
      .map((t) => t.fullName || t.name || t.technicianName)
      .filter(Boolean)
      .join(', '),
    completedTaskCount: extra.completedTaskCount,
    taskNames: extra.taskNames,
    ...extra,
  };
}

module.exports = {
  settlementSnapshot,
  exportRequestSnapshot,
  repairOrderSnapshot,
};
