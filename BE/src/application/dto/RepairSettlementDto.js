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
// Bug lich su: String(value) tren 1 Date object goi Date.prototype.toString()
// (vd "Wed May 10 2023 07:00:00 GMT+0700 ...") chu KHONG phai ISO, khien
// slice(0,10) ra chuoi rac ("Wed May 10") - input type=date o FE render rong
// dù DB co du lieu. Phai check instanceof Date va goi toISOString() truoc.
function toISODate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

class RepairSettlementResponseDto {
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      code: entity.code,
      date: toDDMMYYYYHHmm(entity.intakeDate),
      paidDate: entity.paidAt ? toDDMMYYYYHHmm(entity.paidAt) : null,
      paymentMethod: entity.paymentMethod,
      advisor: entity.advisor?.name || null,
      // Kem ID chu khong chi ten: bo loc "Phiếu của tôi" o man danh sach khop
      // theo id, 2 co van trung ten thi loc theo ten se ra sai.
      advisorId: entity.advisor?.id ?? entity.advisorId ?? null,
      advisorPhone: entity.advisor?.phone || null,
      branch: entity.branchName,
      customer: entity.customer,
      vehicle: entity.vehicle ? { ...entity.vehicle, purchaseDate: toISODate(entity.vehicle.purchaseDate) } : null,
      customerRequest: entity.customerRequest,
      note: entity.note,
      signatureData: entity.signatureData,
      signerName: entity.signerName,
      signedAt: entity.signedAt ? toDDMMYYYYHHmm(entity.signedAt) : null,
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
      lockedByName: entity.lockedBy?.name || null,
      lockedAt: entity.lockedAt ? toDDMMYYYYHHmm(entity.lockedAt) : null,
      ngPendingCount: entity.ngPendingCount ?? 0,
      technicians: entity.technicians,
      // Chuoi ten tho cho man danh sach (man chi tiet dung `technicians`).
      technicianNames: entity.technicianNames ?? null,
      assignedTeamLeaderId: entity.assignedTeamLeaderId ?? null,
      assignedTeamLeaderName: entity.assignedTeamLeaderName ?? null,
      repairOrderId: entity.repairOrderId,
      bayNumber: entity.bayNumber,
      hasCompletedTask: entity.hasCompletedTask,
      hasTechnicians: entity.hasTechnicians,
      status: entity.status,
      cancelReason: entity.cancelReason,
      intakeChecklist: entity.intakeChecklist,
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => RepairSettlementResponseDto.fromEntity(e));
  }
}

const PUBLIC_STATUS_LABELS = {
  waiting_repair: 'Chờ sửa chữa',
  inprogress: 'Đang sửa chữa',
  waiting_payment: 'Chờ thanh toán',
  invoiced: 'Đã hoàn thành',
};

// Dung cho man tra cuu cong khai (Landing, khong dang nhap) - chi lay cac
// truong toi thieu, KHONG bao gom ten/SDT khach hang hay gia tien.
class PublicVehicleHistoryDto {
  static fromRow(row) {
    return {
      code: row.repair_code,
      status: row.status,
      statusLabel: PUBLIC_STATUS_LABELS[row.status] || row.status,
      intakeDate: toDDMMYYYY(row.intake_date),
      completedDate: row.completed_date ? toDDMMYYYY(row.completed_date) : null,
      branchName: row.branch_name,
      maintenanceItems: row.pm_items,
    };
  }

  static fromRows(rows) {
    if (!rows.length) return null;
    return {
      vehicle: {
        licensePlate: rows[0].license_plate,
        vehicleModel: rows[0].vehicle_model_text,
      },
      history: rows.map((r) => PublicVehicleHistoryDto.fromRow(r)),
    };
  }
}

module.exports = RepairSettlementResponseDto;
module.exports.PublicVehicleHistoryDto = PublicVehicleHistoryDto;
