const VehicleBayRepository = require('../../domain/repositories/VehicleBayRepository');
const VehicleBay = require('../../domain/entities/VehicleBay');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');
const ApiError = require('../../utils/ApiError');

// Job "dang hien hanh" cua 1 khoang - lay lenh sua chua inprogress gan nhat
// gan voi bay_id nay (moi khoang chi nen co toi da 1 lenh inprogress tai 1
// thoi diem, do da chan tu VehicleBayService/RepairOrderService.claim).
const HEADER_SELECT = `
  SELECT vb.*, tl.user_name AS team_leader_name,
         ro.id AS active_repair_order_id,
         v.license_plate AS active_license_plate, v.vehicle_model_text AS active_vehicle_model
  FROM   vehicle_bays vb
  LEFT JOIN users tl ON tl.id = vb.team_leader_id
  OUTER APPLY (
    SELECT TOP 1 id, vehicle_id FROM repair_orders
    WHERE bay_id = vb.id AND status = 'inprogress'
    ORDER BY id DESC
  ) ro
  LEFT JOIN vehicles v ON v.id = ro.vehicle_id
`;

class VehicleBayRepositoryImpl extends VehicleBayRepository {
  async findByTeamLeader(teamLeaderId) {
    const result = await query(
      `${HEADER_SELECT} WHERE vb.team_leader_id = @teamLeaderId ORDER BY vb.bay_number`,
      { teamLeaderId }
    );
    return result.recordset.map((r) => VehicleBay.fromPersistence(r));
  }

  async findByBranch(branchId) {
    const result = await query(
      `${HEADER_SELECT} WHERE vb.branch_id = @branchId ORDER BY vb.bay_number`,
      { branchId }
    );
    return result.recordset.map((r) => VehicleBay.fromPersistence(r));
  }

  async findById(id) {
    const result = await query(`${HEADER_SELECT} WHERE vb.id = @id`, { id });
    return VehicleBay.fromPersistence(result.recordset[0]);
  }

  async occupy(id, { teamLeaderId, userId, deviceId }) {
    // 1 khoang chi duoc giu boi DUNG 1 thiet bi tai 1 thoi diem, ke ca giua
    // nhieu thiet bi cua CUNG 1 to truong (vd to truong dang o khoang 13
    // bang tablet A thi khong the vao trung khoang 13 bang tablet B nua) -
    // chi cho chiem khi con trong (NULL) hoac dung chinh thiet bi nay
    // (deviceId khop) dang giu lai.
    const result = await query(
      `UPDATE vehicle_bays
       SET    occupied_by_device_id = @deviceId,
              occupied_by_user_id   = @userId,
              occupied_at           = SYSUTCDATETIME(),
              last_heartbeat_at     = SYSUTCDATETIME()
       WHERE  id = @id
         AND  team_leader_id = @teamLeaderId
         AND  (occupied_by_device_id IS NULL OR occupied_by_device_id = @deviceId)`,
      { id, teamLeaderId, userId, deviceId }
    );
    if (!result.rowsAffected[0]) return null;
    return this.findById(id);
  }

  async release(id, { deviceId }) {
    await query(
      `UPDATE vehicle_bays
       SET    occupied_by_device_id = NULL, occupied_by_user_id = NULL, occupied_at = NULL, last_heartbeat_at = NULL
       WHERE  id = @id AND occupied_by_device_id = @deviceId`,
      { id, deviceId }
    );
  }

  // Tablet dinh ky bao "van con song" - tra ve true neu khoang nay dung la
  // dang do deviceId nay giu (false neu da bi giai phong/nguoi khac chiem,
  // FE se tu quay lai man chon khoang).
  async heartbeat(id, deviceId) {
    const result = await query(
      `UPDATE vehicle_bays SET last_heartbeat_at = SYSUTCDATETIME()
       WHERE id = @id AND occupied_by_device_id = @deviceId`,
      { id, deviceId }
    );
    return Boolean(result.rowsAffected[0]);
  }

  // Job nen goi dinh ky (xem jobs/bayHeartbeatCleanupJob.js) - tu nha cac
  // khoang qua @thresholdSeconds khong heartbeat (mat dien/rot mang/dong tab
  // khong dang xuat...). Tra ve danh sach khoang vua bi nha (kem branchId)
  // de job emit SSE 'bay-released' cho tung chi nhanh.
  async releaseStale(thresholdSeconds) {
    const result = await query(
      `UPDATE vehicle_bays
       SET    occupied_by_device_id = NULL, occupied_by_user_id = NULL, occupied_at = NULL, last_heartbeat_at = NULL
       OUTPUT INSERTED.id, INSERTED.branch_id, INSERTED.bay_number
       WHERE  occupied_by_device_id IS NOT NULL
         AND  last_heartbeat_at < DATEADD(SECOND, -@thresholdSeconds, SYSUTCDATETIME())`,
      { thresholdSeconds }
    );
    return result.recordset.map((r) => ({ id: r.id, branchId: r.branch_id, bayNumber: r.bay_number }));
  }

  async setBayNumbers(branchId, teamLeaderId, bayNumbers) {
    return runInTransaction(async (tx) => {
      const existing = await tx.request().input('branchId', sql.BigInt, branchId)
        .query('SELECT id, bay_number, team_leader_id FROM vehicle_bays WHERE branch_id = @branchId');
      const rows = existing.recordset;
      const mine = rows.filter((r) => Number(r.team_leader_id) === Number(teamLeaderId));
      const others = rows.filter((r) => Number(r.team_leader_id) !== Number(teamLeaderId));

      const desired = new Set(bayNumbers.map(Number));
      const conflict = others.find((o) => desired.has(Number(o.bay_number)));
      if (conflict) {
        throw new ApiError(409, `Khoang số ${conflict.bay_number} đã thuộc tổ trưởng khác trong chi nhánh`);
      }

      const toRemove = mine.filter((m) => !desired.has(Number(m.bay_number)));
      for (const r of toRemove) {
        await tx.request().input('id', sql.BigInt, r.id).query('DELETE FROM vehicle_bays WHERE id = @id');
      }

      const existingNumbers = new Set(mine.map((m) => Number(m.bay_number)));
      for (const n of desired) {
        if (!existingNumbers.has(n)) {
          await tx.request()
            .input('branchId', sql.BigInt, branchId)
            .input('bayNumber', sql.Int, n)
            .input('teamLeaderId', sql.BigInt, teamLeaderId)
            .query('INSERT INTO vehicle_bays (branch_id, bay_number, team_leader_id) VALUES (@branchId, @bayNumber, @teamLeaderId)');
        }
      }
    });
  }
}

module.exports = VehicleBayRepositoryImpl;
