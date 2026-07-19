const MaintenanceReminderRepository = require('../../domain/repositories/MaintenanceReminderRepository');
const MaintenanceReminder = require('../../domain/entities/MaintenanceReminder');
const { query } = require('../database/sqlServer');

const LIST_SELECT = `
  SELECT mr.*,
         v.license_plate      AS vehicle_license_plate,
         v.vehicle_model_text,
         v.current_km         AS vehicle_current_km,
         c.full_name          AS customer_full_name,
         c.phone              AS customer_phone
  FROM   maintenance_reminders mr
  JOIN   vehicles  v ON v.id = mr.vehicle_id
  JOIN   customers c ON c.id = mr.customer_id
`;

// Sinh nhac nho tu du doan bao duong ke tiep (next_maintenance_km/date) cua
// phieu quyet toan GAN NHAT (chua huy) cho tung xe - tranh sinh trung nhieu
// nhac nho cho cung 1 du doan neu ham nay duoc goi lap lai (startup/interval/
// truoc moi lan liet ke).
const SYNC_SQL = `
  ;WITH latest_prediction AS (
    SELECT so.vehicle_id, so.customer_id, so.branch_id,
           so.next_maintenance_km, so.next_maintenance_date,
           ROW_NUMBER() OVER (PARTITION BY so.vehicle_id ORDER BY so.intake_date DESC, so.id DESC) AS rn
    FROM   service_orders so
    WHERE  so.status <> 'cancelled'
      AND  (so.next_maintenance_km IS NOT NULL OR so.next_maintenance_date IS NOT NULL)
  )
  INSERT INTO maintenance_reminders (
    vehicle_id, customer_id, branch_id, reminder_type, due_date, due_km, is_sent, is_confirmed, created_at
  )
  SELECT lp.vehicle_id, lp.customer_id, lp.branch_id, N'Bảo dưỡng định kỳ',
         lp.next_maintenance_date, lp.next_maintenance_km, 0, 0, GETDATE()
  FROM   latest_prediction lp
  WHERE  lp.rn = 1
    AND  NOT EXISTS (
      SELECT 1 FROM maintenance_reminders mr
      WHERE mr.vehicle_id = lp.vehicle_id
        AND ISNULL(mr.due_date, '1900-01-01') = ISNULL(lp.next_maintenance_date, '1900-01-01')
        AND ISNULL(mr.due_km, -1) = ISNULL(lp.next_maintenance_km, -1)
    )
`;

function buildConditions({ branchId, status, search }) {
  const params = { branchId, search: search ? `%${search}%` : null };
  const conditions = ['mr.branch_id = @branchId'];

  if (status === 'pending') {
    conditions.push('mr.is_sent = 0');
  } else if (status === 'sent') {
    conditions.push('mr.is_sent = 1 AND mr.is_confirmed = 0');
  } else if (status === 'confirmed') {
    conditions.push('mr.is_confirmed = 1');
  }

  if (search) {
    conditions.push('(v.license_plate LIKE @search OR c.full_name LIKE @search)');
  }

  return { params, conditions };
}

class MaintenanceReminderRepositoryImpl extends MaintenanceReminderRepository {
  async syncFromServiceOrders() {
    await query(SYNC_SQL);
  }

  async findAll({ branchId, status, search } = {}) {
    const { params, conditions } = buildConditions({ branchId, status, search });
    const sqlText = `${LIST_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY ISNULL(mr.due_date, '9999-12-31') ASC, mr.due_km ASC`;
    const result = await query(sqlText, params);
    return result.recordset.map((row) => MaintenanceReminder.fromPersistence(row));
  }

  async findById(id) {
    const result = await query(`${LIST_SELECT} WHERE mr.id = @id`, { id });
    return MaintenanceReminder.fromPersistence(result.recordset[0]);
  }

  async markSent(id, { notes } = {}) {
    await query(
      `UPDATE maintenance_reminders
       SET    is_sent = 1, sent_at = GETDATE(), notes = COALESCE(@notes, notes)
       WHERE  id = @id`,
      { id, notes: notes || null }
    );
    return this.findById(id);
  }

  async markConfirmed(id, { confirmedDate, notes } = {}) {
    await query(
      `UPDATE maintenance_reminders
       SET    is_confirmed = 1,
              confirmed_date = @confirmedDate,
              is_sent = 1,
              sent_at = COALESCE(sent_at, GETDATE()),
              notes = COALESCE(@notes, notes)
       WHERE  id = @id`,
      { id, confirmedDate, notes: notes || null }
    );
    return this.findById(id);
  }
}

module.exports = MaintenanceReminderRepositoryImpl;
