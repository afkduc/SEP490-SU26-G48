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
