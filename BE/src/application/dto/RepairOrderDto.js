// task_type sao chep tu service_order_items.item_type ('service' | 'product').
const TASK_TYPE_LABELS = {
  service: 'Dịch vụ',
  product: 'Phụ tùng',
};

// Dung cac getter UTC (khong dung .getDate()/.getHours() local) - xem giai
// thich trong utils/dateVN.js: mssql (tedious, useUTC mac dinh true) doc/ghi
// cot datetime theo truc UTC cua JS Date, khong lien quan mui gio VN.
function toDDMMYYYY(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function toHHmm(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

class RepairOrderResponseDto {
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      code: entity.code,
      serviceOrderId: entity.serviceOrderId,
      branch: entity.branchName,
      teamLeader: entity.teamLeaderId
        ? { id: entity.teamLeaderId, fullName: entity.teamLeaderName, specialty: entity.teamLeaderSpecialty }
        : null,
      bayId: entity.bayId,
      bayNumber: entity.bayNumber,
      technicians: entity.technicians,
      createdByName: entity.createdByName,
      advisorName: entity.advisorName,
      intakeChecklist: entity.intakeChecklist,
      customer: entity.customer,
      vehicle: entity.vehicle,
      status: entity.status,
      notes: entity.notes,
      createdAt: toDDMMYYYY(entity.createdAt),
      createdAtTime: toHHmm(entity.createdAt),
      completedAt: toDDMMYYYY(entity.completedAt),
      completedAtTime: toHHmm(entity.completedAt),
      cancelReason: entity.cancelReason,
      tasks: entity.tasks.map((t) => ({
        ...t,
        taskTypeLabel: TASK_TYPE_LABELS[t.taskType] || t.taskType,
      })),
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => RepairOrderResponseDto.fromEntity(e));
  }
}

module.exports = RepairOrderResponseDto;
