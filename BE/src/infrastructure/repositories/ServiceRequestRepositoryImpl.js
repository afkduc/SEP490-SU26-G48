const ServiceRequestRepository = require('../../domain/repositories/ServiceRequestRepository');
const ServiceRequest = require('../../domain/entities/ServiceRequest');
const ServiceAppointment = require('../../domain/entities/ServiceAppointment');
const { query, sql } = require('../database/sqlServer');

// Cot join dung chung: ten chi nhanh mua xe, ten chi nhanh gan nhat, ten CVDV
// da tiep nhan (neu co). Khong dung OUTER APPLY lay luon appointment o day de
// tranh trung ten cot (sr.id vs appointment.id) bi ghi de trong recordset -
// appointment duoc lay rieng roi gop lai trong JS (xem attachAppointments).
const HEADER_SELECT = `
  SELECT sr.*,
         pb.branch_name AS purchase_branch_name,
         nb.branch_name AS nearest_branch_name,
         au.user_name   AS accepted_by_name
  FROM   service_requests sr
  LEFT JOIN branches pb ON pb.id = sr.purchase_branch_id
  JOIN   branches nb    ON nb.id = sr.nearest_branch_id
  LEFT JOIN users au    ON au.id = sr.accepted_by
`;

async function fetchLatestAppointmentsByRequestIds(ids) {
  if (!ids.length) return new Map();
  const idList = ids.map((id) => Number(id)).join(',');
  const result = await query(`
    SELECT sa.*, cu.user_name AS created_by_name
    FROM   service_appointments sa
    JOIN   users cu ON cu.id = sa.created_by
    WHERE  sa.service_request_id IN (${idList})
    ORDER  BY sa.id DESC
  `);
  const map = new Map();
  for (const row of result.recordset) {
    if (!map.has(row.service_request_id)) {
      map.set(row.service_request_id, ServiceAppointment.fromPersistence(row));
    }
  }
  return map;
}

class ServiceRequestRepositoryImpl extends ServiceRequestRepository {
  async create(data) {
    const result = await query(
      `
      INSERT INTO service_requests (
        full_name, gender, phone, email, address, issue_description,
        purchase_branch_id, purchase_branch_other, vehicle_brand_other,
        nearest_branch_id, status, created_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @fullName, @gender, @phone, @email, @address, @issueDescription,
        @purchaseBranchId, @purchaseBranchOther, @vehicleBrandOther,
        @nearestBranchId, 'pending', GETUTCDATE()
      )
      `,
      {
        fullName: data.fullName,
        gender: data.gender || null,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        issueDescription: data.issueDescription,
        purchaseBranchId: data.purchaseBranchId || null,
        purchaseBranchOther: data.purchaseBranchOther || null,
        vehicleBrandOther: data.vehicleBrandOther || null,
        nearestBranchId: data.nearestBranchId,
      }
    );
    const newId = result.recordset[0].id;
    return this.findById(newId);
  }

  async findByBranch(branchId, { status } = {}) {
    const filter = status ? 'AND sr.status = @status' : '';
    const params = { branchId };
    if (status) params.status = status;
    const result = await query(
      `${HEADER_SELECT} WHERE sr.nearest_branch_id = @branchId ${filter} ORDER BY sr.created_at DESC`,
      params
    );
    const appointments = await fetchLatestAppointmentsByRequestIds(result.recordset.map((r) => r.id));
    return result.recordset.map((row) => ServiceRequest.fromPersistence(row, appointments.get(row.id) || null));
  }

  async findById(id) {
    const result = await query(`${HEADER_SELECT} WHERE sr.id = @id`, { id });
    const row = result.recordset[0];
    if (!row) return null;
    const appointments = await fetchLatestAppointmentsByRequestIds([row.id]);
    return ServiceRequest.fromPersistence(row, appointments.get(row.id) || null);
  }

  // Atomic claim - chi 1 CVDV duy nhat "thang" khi nhieu nguoi cung bam
  // "Tiep nhan" gan nhu cung luc, nho dieu kien "WHERE status = 'pending'"
  // ket hop voi row-locking mac dinh cua SQL Server cho 1 cau UPDATE.
  async acceptAtomic(id, userId) {
    const result = await query(
      `
      UPDATE service_requests
      SET    status = 'accepted', accepted_by = @userId, accepted_at = GETUTCDATE()
      OUTPUT INSERTED.id
      WHERE  id = @id AND status = 'pending'
      `,
      { id, userId }
    );
    if (result.recordset.length === 0) return null; // da bi nguoi khac tiep nhan truoc
    return this.findById(id);
  }

  async countPendingByBranch(branchId) {
    const result = await query(
      `SELECT COUNT(*) AS cnt FROM service_requests WHERE nearest_branch_id = @branchId AND status = 'pending'`,
      { branchId }
    );
    return result.recordset[0].cnt;
  }

  async createAppointment(serviceRequestId, data, createdBy) {
    const result = await query(
      `
      INSERT INTO service_appointments (
        service_request_id, appointment_at, notes, status, created_by, created_at
      )
      OUTPUT INSERTED.id
      VALUES (@serviceRequestId, @appointmentAt, @notes, 'scheduled', @createdBy, GETUTCDATE())
      `,
      {
        serviceRequestId,
        // Truyen Date object (khong phai string) de mssql tu nhan dien kieu
        // DateTime khi bind param - tranh loi/implicit-convert khong chac chan.
        appointmentAt: new Date(data.appointmentAt),
        notes: data.notes || null,
        createdBy,
      }
    );
    return this.findAppointmentById(result.recordset[0].id);
  }

  async updateAppointment(appointmentId, data) {
    await query(
      `
      UPDATE service_appointments
      SET    appointment_at = @appointmentAt, notes = @notes, updated_at = GETUTCDATE()
      WHERE  id = @appointmentId AND status = 'scheduled'
      `,
      { appointmentId, appointmentAt: new Date(data.appointmentAt), notes: data.notes || null }
    );
    return this.findAppointmentById(appointmentId);
  }

  async cancelAppointment(appointmentId, reason, cancelledBy) {
    await query(
      `
      UPDATE service_appointments
      SET    status = 'cancelled', cancel_reason = @reason, cancelled_by = @cancelledBy, cancelled_at = GETUTCDATE()
      WHERE  id = @appointmentId AND status = 'scheduled'
      `,
      { appointmentId, reason, cancelledBy }
    );
    return this.findAppointmentById(appointmentId);
  }

  async findAppointmentById(appointmentId) {
    const result = await query(
      `
      SELECT sa.*, cu.user_name AS created_by_name
      FROM   service_appointments sa
      JOIN   users cu ON cu.id = sa.created_by
      WHERE  sa.id = @appointmentId
      `,
      { appointmentId }
    );
    return ServiceAppointment.fromPersistence(result.recordset[0]);
  }
}

module.exports = ServiceRequestRepositoryImpl;
