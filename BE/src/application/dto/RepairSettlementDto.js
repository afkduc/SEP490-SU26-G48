// Format 1 Date/string ve dd/mm/yyyy (khop voi o "Ngay ke tiep" cua FE, dang la input text tu do).
function toDDMMYYYY(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Format ve yyyy-mm-dd (khop voi vehicleInfo.purchaseDate FE dang dung).
function toISODate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

class RepairSettlementResponseDto {
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      code: entity.code,
      date: toDDMMYYYY(entity.intakeDate),
      advisor: entity.advisor?.name || null,
      advisorPhone: entity.advisor?.phone || null,
      branch: entity.branchName,
      customer: entity.customer,
      vehicle: entity.vehicle ? { ...entity.vehicle, purchaseDate: toISODate(entity.vehicle.purchaseDate) } : null,
      customerRequest: entity.customerRequest,
      items: entity.items,
      subtotal: entity.subtotal,
      discountAmount: entity.discountAmount,
      afterDiscount: entity.afterDiscount,
      vat: entity.vat,
      freeAmount: entity.freeAmount,
      total: entity.total,
      nextMaintenanceKm: entity.nextMaintenanceKm,
      nextMaintenanceDate: toDDMMYYYY(entity.nextMaintenanceDate),
      teamLeader: entity.teamLeaderName,
      status: entity.status,
      cancelReason: entity.cancelReason,
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => RepairSettlementResponseDto.fromEntity(e));
  }
}

module.exports = RepairSettlementResponseDto;
