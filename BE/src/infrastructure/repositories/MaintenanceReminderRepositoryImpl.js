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

// Sinh 3 moc nhac nho co dinh cho MOI phieu quyet toan (chua huy), tinh tu
// ngay tao phieu (intake_date) - khong con phu thuoc CVDV go tay so
// km/ngay bao duong ke tiep nua (da bo han 2 truong nay, xem
// RepairSettlementRepositoryImpl): 1 tuan (cham soc/hoi tham sau sua chua),
// 1 thang va 2 thang (nhac bao duong dinh ky). Dedup theo (repair_order_id,
// reminder_type) - moi phieu chi sinh dung 1 nhac nho cho moi moc, du ham
// nay duoc goi lap lai nhieu lan (startup/interval/truoc moi lan liet ke).
const SYNC_SQL = `
  ;WITH milestones AS (
    SELECT so.id AS repair_order_id, so.vehicle_id, so.customer_id, so.branch_id,
           N'Chăm sóc sau sửa chữa (1 tuần)' AS reminder_type,
           CAST(DATEADD(DAY, 7, so.intake_date) AS DATE) AS due_date
    FROM   repair_orders so
    WHERE  so.status <> 'cancelled'
    UNION ALL
    SELECT so.id, so.vehicle_id, so.customer_id, so.branch_id,
           N'Nhắc bảo dưỡng định kỳ (1 tháng)',
           CAST(DATEADD(MONTH, 1, so.intake_date) AS DATE)
    FROM   repair_orders so
    WHERE  so.status <> 'cancelled'
    UNION ALL
    SELECT so.id, so.vehicle_id, so.customer_id, so.branch_id,
           N'Nhắc bảo dưỡng định kỳ (2 tháng)',
           CAST(DATEADD(MONTH, 2, so.intake_date) AS DATE)
    FROM   repair_orders so
    WHERE  so.status <> 'cancelled'
  )
  INSERT INTO maintenance_reminders (
    repair_order_id, vehicle_id, customer_id, branch_id, reminder_type, due_date, is_sent, is_confirmed, created_at
  )
  SELECT m.repair_order_id, m.vehicle_id, m.customer_id, m.branch_id, m.reminder_type, m.due_date, 0, 0, GETDATE()
  FROM   milestones m
  WHERE  NOT EXISTS (
    SELECT 1 FROM maintenance_reminders mr
    WHERE mr.repair_order_id = m.repair_order_id
      AND mr.reminder_type = m.reminder_type
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
    const sqlText = `${LIST_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY mr.due_date ASC, mr.id ASC`;
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
