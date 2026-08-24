function appointmentToDto(apt) {
  if (!apt) return null;
  return {
    id: apt.id,
    appointmentAt: apt.appointmentAt,
    notes: apt.notes,
    status: apt.status,
    cancelReason: apt.cancelReason,
    createdBy: apt.createdBy,
    createdByName: apt.createdByName,
    createdAt: apt.createdAt,
    updatedAt: apt.updatedAt,
    cancelledBy: apt.cancelledBy,
    cancelledAt: apt.cancelledAt,
  };
}

class ServiceRequestResponseDto {
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      fullName: entity.fullName,
      gender: entity.gender,
      phone: entity.phone,
      email: entity.email,
      address: entity.address,
      issueDescription: entity.issueDescription,
      purchaseBranchId: entity.purchaseBranchId,
      purchaseBranchName: entity.purchaseBranchName,
      purchaseBranchOther: entity.purchaseBranchOther,
      vehicleBrandOther: entity.vehicleBrandOther,
      nearestBranchId: entity.nearestBranchId,
      nearestBranchName: entity.nearestBranchName,
      status: entity.status,
      acceptedBy: entity.acceptedBy,
      acceptedByName: entity.acceptedByName,
      acceptedAt: entity.acceptedAt,
      createdAt: entity.createdAt,
      appointment: appointmentToDto(entity.appointment),
    };
  }

  static fromEntityList(entities) {
    return entities.map((e) => ServiceRequestResponseDto.fromEntity(e));
  }
}

module.exports = ServiceRequestResponseDto;
