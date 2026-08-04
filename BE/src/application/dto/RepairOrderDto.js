// task_type sao chep tu service_order_items.item_type ('service' | 'product').
const TASK_TYPE_LABELS = {
  service: 'Dịch vụ',
  product: 'Phụ tùng',
};

function toDDMMYYYY(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
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
      technicians: entity.technicians,
      createdByName: entity.createdByName,
      customer: entity.customer,
      vehicle: entity.vehicle,
      status: entity.status,
      notes: entity.notes,
      createdAt: toDDMMYYYY(entity.createdAt),
      completedAt: toDDMMYYYY(entity.completedAt),
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
