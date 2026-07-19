function toDDMMYYYY(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

class MaintenanceReminderResponseDto {
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      reminderType: entity.reminderType,
      dueDate: toDDMMYYYY(entity.dueDate),
      dueKm: entity.dueKm,
      isSent: entity.isSent,
      sentAt: toDDMMYYYY(entity.sentAt),
      isConfirmed: entity.isConfirmed,
      confirmedDate: toDDMMYYYY(entity.confirmedDate),
      notes: entity.notes,
      createdAt: toDDMMYYYY(entity.createdAt),
      customer: entity.customer,
      vehicle: entity.vehicle,
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => MaintenanceReminderResponseDto.fromEntity(e));
  }
}

module.exports = MaintenanceReminderResponseDto;
