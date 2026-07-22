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
         c.full_name    AS customer_full_name,
         so.advisor_id  AS advisor_id
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
  // Man "Lenh sua chua" la bang dieu phoi chung ca chi nhanh - khong loc theo
  // advisorId, de bat ky co van dich vu nao cung thay het de gan to truong.
  // Rieng to truong dang nhap (teamLeaderId duoc truyen vao) thi CHI thay
  // dung lenh duoc giao cho minh - xem "Cong viec cua toi".
  async findAll({ branchId, teamLeaderId } = {}) {
    const params = { branchId };
    let sqlText = `${HEADER_SELECT} WHERE ro.branch_id = @branchId`;
    if (teamLeaderId) {
      params.teamLeaderId = Number(teamLeaderId);
      sqlText += ` AND ro.team_leader_id = @teamLeaderId`;
    }
    sqlText += ` ORDER BY ro.id DESC`;
    const result = await query(sqlText, params);
    const rows = result.recordset;

    // Man dieu phoi cua co van khong can hien task tung dong (chi xem qua modal
    // chi tiet rieng) nen giu nguyen [] cho nhe. Rieng man "Cong viec cua toi"
    // cua to truong (loc theo teamLeaderId) hien task ngay tren card nen phai
    // lay kem danh sach task cho tung lenh.
    if (!teamLeaderId || rows.length === 0) {
      return rows.map((row) => RepairOrder.fromPersistence(row, []));
    }

    const ids = rows.map((row) => row.id);
    const inClause = ids.map((_, i) => `@id${i}`).join(',');
    const taskParams = {};
    ids.forEach((rid, i) => { taskParams[`id${i}`] = rid; });
    const tasksResult = await query(
      `SELECT * FROM repair_order_tasks WHERE repair_order_id IN (${inClause}) ORDER BY id`,
      taskParams
    );
    const tasksByOrder = new Map();
    tasksResult.recordset.forEach((t) => {
      if (!tasksByOrder.has(t.repair_order_id)) tasksByOrder.set(t.repair_order_id, []);
      tasksByOrder.get(t.repair_order_id).push(t);
    });

    return rows.map((row) => RepairOrder.fromPersistence(row, tasksByOrder.get(row.id) || []));
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
        .input('status', sql.VarChar(20), 'inprogress')
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

      const insertTask = async ({ taskName, taskType, productId, quantity, unitPrice }) => {
        await tx
          .request()
          .input('repairOrderId', sql.BigInt, id)
          .input('taskName', sql.NVarChar(300), taskName)
          .input('taskType', sql.VarChar(10), taskType)
          .input('productId', sql.BigInt, productId || null)
          .input('quantity', sql.Int, quantity || 0)
          .input('unitPrice', sql.Decimal(18, 2), unitPrice || 0)
          .query(`
            INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done)
            VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0)
          `);
      };

      for (const item of itemsResult.recordset) {
        // Dong "goi dich vu" trong service_order_items la 1 dong duy nhat, khong
        // co service_id (chi dich vu le duoc chon rieng moi co service_id), va
        // luu ma goi trong item_code. Tach dong nay thanh N task con (1 task /
        // 1 dich vu le trong goi) de to truong tick tung dau muc rieng.
        const isPackageRow = item.item_type === 'service' && !item.service_id;

        if (isPackageRow) {
          const pkgServicesResult = await tx
            .request()
            .input('code', sql.VarChar(30), item.item_code)
            .query(`
              SELECT s.service_name
              FROM   service_packages sp
              JOIN   service_package_items spi ON spi.package_id = sp.id
              JOIN   services s ON s.id = spi.service_id
              WHERE  sp.package_code = @code
              ORDER  BY s.service_name
            `);

          if (pkgServicesResult.recordset.length > 0) {
            for (const svc of pkgServicesResult.recordset) {
              await insertTask({ taskName: svc.service_name, taskType: 'service', quantity: 1, unitPrice: 0 });
            }
            continue;
          }
          // Khong tim thay goi (du lieu la, hiem) -> roi xuong tao 1 task gom
          // chung nhu cu de khong mat viec.
        }

        await insertTask({
          taskName: item.item_description,
          taskType: item.item_type,
          productId: item.product_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
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

  async updateTaskStatus(taskId, isDone) {
    await query('UPDATE repair_order_tasks SET is_done = @isDone WHERE id = @taskId', {
      taskId: Number(taskId),
      isDone: isDone ? 1 : 0,
    });
  }

  async updateStatus(id, status, cancelReason) {
    await runInTransaction(async (tx) => {
      await tx
        .request()
        .input('id', sql.BigInt, id)
        .input('status', sql.VarChar(20), status)
        .input('cancelReason', sql.NVarChar(500), cancelReason || null)
        .query(`
          UPDATE repair_orders
          SET    status = @status,
                 completed_at = CASE WHEN @status = 'completed' THEN GETDATE() ELSE completed_at END,
                 cancel_reason = CASE WHEN @status = 'cancelled' THEN @cancelReason ELSE cancel_reason END
          WHERE  id = @id
        `);

      // Khach huy giua chung -> tra phieu quyet toan goc ve "Cho sua chua" va
      // bo to truong da gan, de co the phan cong lai tu dau (khong de phieu bi
      // ket lai o trang thai "inprogress" ma khong ai thuc su dang lam).
      if (status === 'cancelled') {
        await tx
          .request()
          .input('id', sql.BigInt, id)
          .query(`
            UPDATE so
            SET    so.team_leader_id = NULL,
                   so.status = 'waiting_repair'
            FROM   service_orders so
            JOIN   repair_orders ro ON ro.service_order_id = so.id
            WHERE  ro.id = @id
          `);
      }
    });
    return this.findById(id);
  }
}

module.exports = RepairOrderRepositoryImpl;
