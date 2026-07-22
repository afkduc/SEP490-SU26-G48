/**
 * ServiceAppointment - lich hen tu van do CVDV tao sau khi tiep nhan 1
 * ServiceRequest. Tuong ung bang `service_appointments`.
 */
class ServiceAppointment {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.serviceRequestId = data.serviceRequestId ?? null;
    this.appointmentAt = data.appointmentAt ?? null;
    this.notes = data.notes ?? null;
    this.status = data.status ?? 'scheduled';
    this.cancelReason = data.cancelReason ?? null;
    this.createdBy = data.createdBy ?? null;
    this.createdByName = data.createdByName ?? null;
    this.createdAt = data.createdAt ?? null;
    this.updatedAt = data.updatedAt ?? null;
    this.cancelledBy = data.cancelledBy ?? null;
    this.cancelledAt = data.cancelledAt ?? null;
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new ServiceAppointment({
      id: row.id,
      serviceRequestId: row.service_request_id,
      appointmentAt: row.appointment_at,
      notes: row.notes,
      status: row.status,
      cancelReason: row.cancel_reason,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledBy: row.cancelled_by,
      cancelledAt: row.cancelled_at,
    });
  }
}

module.exports = ServiceAppointment;
