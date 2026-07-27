// Format 1 Date/string ve dd/mm/yyyy (khop voi cac o ngay dang input text tu do o FE).
// Dung cac getter UTC (khong dung .getDate()/.getHours() local) vi mssql
// (tedious, useUTC mac dinh true) doc/ghi cot date/datetime cua SQL Server
// theo truc UTC cua JS Date - dung getter local se bi lech theo mui gio he
// dieu hanh cua may chu Node, khong lien quan gi den mui gio Viet Nam.
function toDDMMYYYY(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// Nhu toDDMMYYYY nhung kem gio:phut - dung cho ngay tiep nhan (intake_date la
// datetime, co gio thuc te xe vao xuong, khong chi rieng ngay).
function toDDMMYYYYHHmm(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${toDDMMYYYY(value)} ${hh}:${min}`;
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
      date: toDDMMYYYYHHmm(entity.intakeDate),
      paidDate: entity.paidAt ? toDDMMYYYY(entity.paidAt) : null,
      advisor: entity.advisor?.name || null,
      advisorPhone: entity.advisor?.phone || null,
      branch: entity.branchName,
      customer: entity.customer,
      vehicle: entity.vehicle ? { ...entity.vehicle, purchaseDate: toISODate(entity.vehicle.purchaseDate) } : null,
      customerRequest: entity.customerRequest,
      items: entity.items,
      tasks: entity.tasks,
      subtotal: entity.subtotal,
      discountAmount: entity.discountAmount,
      afterDiscount: entity.afterDiscount,
      vat: entity.vat,
      freeAmount: entity.freeAmount,
      total: entity.total,
      isWarranty: entity.isWarranty,
      teamLeader: entity.teamLeaderName,
      repairOrderId: entity.repairOrderId,
      status: entity.status,
      cancelReason: entity.cancelReason,
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => RepairSettlementResponseDto.fromEntity(e));
  }
}

module.exports = RepairSettlementResponseDto;
