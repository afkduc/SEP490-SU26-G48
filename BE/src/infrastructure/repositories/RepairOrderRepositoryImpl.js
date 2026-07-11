const RepairOrderRepository = require('../../domain/repositories/RepairOrderRepository');
const RepairOrder = require('../../domain/entities/RepairOrder');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

// Cot join dung chung cho findAll/findById - lay ten chi nhanh, to truong,
// nguoi tao, xe va khach hang (khach hang di qua service_orders vi repair_orders
// khong luu truc tiep customer_id).
const HEADER_SELECT = `
  SELECT ro.*,
         b.branch_name,
         tl.user_name   AS team_leader_name,
         tlspec.names   AS team_leader_specialty,
         creator.user_name AS created_by_name,
         v.license_plate    AS vehicle_license_plate,
         v.vehicle_model_text,
         c.id           AS customer_id,
         c.full_name    AS customer_full_name
  FROM   repair_orders ro
  JOIN   branches b      ON b.id = ro.branch_id
  JOIN   users    tl     ON tl.id = ro.team_leader_id
  JOIN   users    creator ON creator.id = ro.created_by
  LEFT JOIN vehicles v       ON v.id = ro.vehicle_id
  LEFT JOIN service_orders so ON so.id = ro.service_order_id
  LEFT JOIN customers c       ON c.id = so.customer_id
  OUTER APPLY (
      SELECT STRING_AGG(sp.specialty_name, ', ') AS names
      FROM   user_specialty us
      JOIN   specialties sp ON sp.id = us.specialty_id
      WHERE  us.user_id = tl.id
  ) tlspec
`;

function genCode(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(3, '0')}`;
}

class RepairOrderRepositoryImpl extends RepairOrderRepository {
  async findAll({ branchId } = {}) {
    const result = await query(
      `${HEADER_SELECT} WHERE ro.branch_id = @branchId ORDER BY ro.id DESC`,
      { branchId }
    );
    return result.recordset.map((row) => RepairOrder.fromPersistence(row, []));
  }

  async findById(id) {
    const headerResult = await query(`${HEADER_SELECT} WHERE ro.id = @id`, { id });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const tasksResult = await query(
      `SELECT * FROM repair_order_tasks WHERE repair_order_id = @id ORDER BY id`,
      { id }
    );
    return RepairOrder.fromPersistence(header, tasksResult.recordset);
  }

  async findTeamLeadersByBranch(branchId) {
    const result = await query(
      `SELECT u.id, u.pseudo_id, u.user_name, u.phone, u.team_size,
              STRING_AGG(sp.specialty_name, ', ') AS specialty_names
       FROM   users u
       JOIN   user_role ur ON ur.user_id = u.id
       JOIN   roles r      ON r.id = ur.role_id AND r.role_name = 'team_leader'
       LEFT JOIN user_specialty us ON us.user_id = u.id
       LEFT JOIN specialties sp    ON sp.id = us.specialty_id
       WHERE  u.branch_id = @branchId AND u.status = 'active'
       GROUP  BY u.id, u.pseudo_id, u.user_name, u.phone, u.team_size
       ORDER  BY u.user_name`,
      { branchId }
    );
    return result.recordset.map((r) => ({
      id: r.id,
      pseudoId: r.pseudo_id,
      fullName: r.user_name,
      phone: r.phone,
      specialty: r.specialty_names,
      teamSize: r.team_size,
    }));
  }

  async findEligibleServiceOrder(serviceOrderId, branchId) {
    const result = await query(
      `SELECT so.id, so.branch_id, so.status, so.vehicle_id
       FROM   service_orders so
       WHERE  so.id = @serviceOrderId AND so.branch_id = @branchId`,
      { serviceOrderId, branchId }
    );
    return result.recordset[0] || null;
  }

  async create(data, { branchId, createdBy }) {
    const newId = await runInTransaction(async (tx) => {
      const itemsResult = await tx
        .request()
        .input('serviceOrderId', sql.BigInt, data.serviceOrderId)
        .query(`SELECT * FROM service_order_items WHERE service_order_id = @serviceOrderId ORDER BY id`);

      const headerResult = await tx
        .request()
        .input('serviceOrderId', sql.BigInt, data.serviceOrderId)
        .input('branchId', sql.BigInt, branchId)
        .input('teamLeaderId', sql.BigInt, data.teamLeaderId)
        .input('vehicleId', sql.BigInt, data.vehicleId)
        .input('createdBy', sql.BigInt, createdBy)
        .input('status', sql.VarChar(20), 'in_progress')
        .input('notes', sql.NVarChar(500), data.notes || null)
        .query(`
          INSERT INTO repair_orders (
            repair_code, service_order_id, branch_id, team_leader_id, vehicle_id,
            created_by, status, notes, created_at
          )
          VALUES (
            '', @serviceOrderId, @branchId, @teamLeaderId, @vehicleId,
            @createdBy, @status, @notes, GETDATE()
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);

      const id = headerResult.recordset[0].id;
      await tx.request().input('id', sql.BigInt, id).input('code', sql.VarChar(30), genCode('LSC', id))
        .query(`UPDATE repair_orders SET repair_code = @code WHERE id = @id`);

      for (const item of itemsResult.recordset) {
        await tx
          .request()
          .input('repairOrderId', sql.BigInt, id)
          .input('taskName', sql.NVarChar(300), item.item_description)
          .input('taskType', sql.VarChar(10), item.item_type)
          .input('productId', sql.BigInt, item.product_id || null)
          .input('quantity', sql.Int, item.quantity || 0)
          .input('unitPrice', sql.Decimal(18, 2), item.unit_price || 0)
          .query(`
            INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done)
            VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0)
          `);
      }

      await tx
        .request()
        .input('serviceOrderId', sql.BigInt, data.serviceOrderId)
        .input('teamLeaderId', sql.BigInt, data.teamLeaderId)
        .query(`UPDATE service_orders SET team_leader_id = @teamLeaderId, status = 'inprogress' WHERE id = @serviceOrderId`);

      return id;
    });

    return this.findById(newId);
  }
}

module.exports = RepairOrderRepositoryImpl;
