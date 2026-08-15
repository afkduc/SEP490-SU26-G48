const RepairOrderRepository = require('../../domain/repositories/RepairOrderRepository');
const RepairOrder = require('../../domain/entities/RepairOrder');
const { query, sql, getPool } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { buildDesiredTasks } = require('./repairOrderTaskBuilder');

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
         so.advisor_id  AS advisor_id,
         adv.user_name  AS advisor_name,
         so.intake_checklist AS intake_checklist,
         vb.bay_number  AS vb_bay_number
  FROM   repair_orders ro
  JOIN   branches b      ON b.id = ro.branch_id
  JOIN   users    tl     ON tl.id = ro.team_leader_id
  JOIN   users    creator ON creator.id = ro.created_by
  LEFT JOIN vehicles v       ON v.id = ro.vehicle_id
  LEFT JOIN service_orders so ON so.id = ro.service_order_id
  LEFT JOIN customers c       ON c.id = so.customer_id
  LEFT JOIN users     adv    ON adv.id = so.advisor_id
  LEFT JOIN vehicle_bays vb  ON vb.id = ro.bay_id
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

// Nhieu tho cung sua 1 xe (repair_order_technicians) - gom theo repair_order_id
// giong cach lam voi repair_order_tasks, dung chung cho findAll/findById/findByCode.
async function fetchTechniciansByOrderIds(ids) {
  const techniciansByOrder = new Map();
  if (ids.length === 0) return techniciansByOrder;

  const inClause = ids.map((_, i) => `@id${i}`).join(',');
  const params = {};
  ids.forEach((rid, i) => { params[`id${i}`] = rid; });
  const result = await query(
    `SELECT rot.repair_order_id, u.id, u.user_name, u.phone, u.team_leader_id
     FROM   repair_order_technicians rot
     JOIN   users u ON u.id = rot.technician_id
     WHERE  rot.repair_order_id IN (${inClause})
     ORDER BY u.user_name ASC`,
    params
  );
  result.recordset.forEach((r) => {
    if (!techniciansByOrder.has(r.repair_order_id)) techniciansByOrder.set(r.repair_order_id, []);
    techniciansByOrder.get(r.repair_order_id).push(r);
  });
  return techniciansByOrder;
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
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const techniciansByOrder = await fetchTechniciansByOrderIds(ids);

    // Man dieu phoi cua co van khong can hien task tung dong (chi xem qua modal
    // chi tiet rieng) nen giu nguyen [] cho nhe. Rieng man "Cong viec cua toi"
    // cua to truong (loc theo teamLeaderId) hien task ngay tren card nen phai
    // lay kem danh sach task cho tung lenh.
    if (!teamLeaderId) {
      return rows.map((row) => RepairOrder.fromPersistence(row, [], techniciansByOrder.get(row.id) || []));
    }

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

    return rows.map((row) => RepairOrder.fromPersistence(row, tasksByOrder.get(row.id) || [], techniciansByOrder.get(row.id) || []));
  }

  async findById(id) {
    const headerResult = await query(`${HEADER_SELECT} WHERE ro.id = @id`, { id });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const tasksResult = await query(
      `SELECT * FROM repair_order_tasks WHERE repair_order_id = @id ORDER BY id`,
      { id }
    );
    const techniciansByOrder = await fetchTechniciansByOrderIds([header.id]);
    return RepairOrder.fromPersistence(header, tasksResult.recordset, techniciansByOrder.get(header.id) || []);
  }

  async findByCode(code) {
    const headerResult = await query(`${HEADER_SELECT} WHERE ro.repair_code = @code`, { code });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const tasksResult = await query(
      `SELECT * FROM repair_order_tasks WHERE repair_order_id = @id ORDER BY id`,
      { id: header.id }
    );
    const techniciansByOrder = await fetchTechniciansByOrderIds([header.id]);
    return RepairOrder.fromPersistence(header, tasksResult.recordset, techniciansByOrder.get(header.id) || []);
  }

  // Public - dung cho Landing "Tra cuu tien do sua chua". Ma khach hang thuc
  // su duoc cap khi tiep nhan xe la ma PHIEU QUYET TOAN (service_orders.order_code,
  // vd "RO-2026-068") - ma lenh sua chua (repair_orders.repair_code, "LSC-...")
  // chi sinh ra SAU khi co van gan to truong, khach hang khong biet ma nay.
  // Vi vay tra cuu phai tim theo order_code truoc tien, roi moi noi sang
  // repair_orders (neu da co) de lay checklist chi tiet.
  async findByServiceOrderCode(code) {
    const settlementResult = await query(
      `SELECT so.id, so.order_code, so.status, so.intake_date, b.branch_name
       FROM   service_orders so
       JOIN   branches b ON b.id = so.branch_id
       WHERE  so.order_code = @code`,
      { code }
    );
    const settlement = settlementResult.recordset[0];
    if (!settlement) return null;

    if (settlement.status === 'cancelled') {
      return {
        code: settlement.order_code,
        status: 'cancelled',
        branchName: settlement.branch_name,
        createdAt: settlement.intake_date,
        completedAt: null,
        tasks: [],
      };
    }

    // Loai tru lenh sua chua da HUY: khach huy giua chung se lam phieu quyet
    // toan goc tu tra ve "waiting_repair" (xem updateStatus ben duoi) de co
    // van gan lai to truong khac, nhung dong repair_orders da huy do van con
    // luu lai (lich su) - khong duoc coi no la lenh "dang hien hanh" cua
    // phieu nay nua, keo lai bi bao nham trang thai "cancelled".
    const roResult = await query(
      `SELECT TOP 1 id, status, completed_at FROM repair_orders
       WHERE service_order_id = @id AND status <> 'cancelled'
       ORDER BY id DESC`,
      { id: settlement.id }
    );
    const repairOrder = roResult.recordset[0];

    if (repairOrder) {
      const tasksResult = await query(
        `SELECT task_name, task_type, is_done FROM repair_order_tasks WHERE repair_order_id = @id ORDER BY id`,
        { id: repairOrder.id }
      );
      return {
        code: settlement.order_code,
        status: repairOrder.status,
        branchName: settlement.branch_name,
        createdAt: settlement.intake_date,
        completedAt: repairOrder.completed_at,
        tasks: tasksResult.recordset.map((t) => ({ taskName: t.task_name, taskType: t.task_type, isDone: Boolean(t.is_done) })),
      };
    }

    // Chua gan to truong (chua co lenh sua chua) - dung lai chinh logic suy ra
    // checklist tu hang muc phieu quyet toan (buildDesiredTasks, giong het luc
    // tao lenh sua chua that su) de lam danh sach "sap toi" tam thoi, tat ca
    // deu chua lam.
    const pool = await getPool();
    const desiredTasks = await buildDesiredTasks(pool, settlement.id);
    return {
      code: settlement.order_code,
      status: 'pending_assignment',
      branchName: settlement.branch_name,
      createdAt: settlement.intake_date,
      completedAt: null,
      tasks: desiredTasks.map((t) => ({ taskName: t.taskName, taskType: t.taskType, isDone: false })),
    };
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

  // Tho tu nhan viec qua khoang xe - UPDATE
  // service_orders co dieu kien "status='waiting_repair'" va kiem tra
  // rowsAffected de phat hien 2 khoang nhan trung 1 phieu cung luc (race) -
  // thua thi rollback ca transaction, tra ve null cho service bao 409.
  async claim(data, { branchId, teamLeaderId, bayId, createdBy }) {
    const newId = await runInTransaction(async (tx) => {
      const claimResult = await tx
        .request()
        .input('serviceOrderId', sql.BigInt, data.serviceOrderId)
        .input('teamLeaderId', sql.BigInt, teamLeaderId)
        .query(`
          UPDATE service_orders SET team_leader_id = @teamLeaderId, status = 'inprogress'
          WHERE id = @serviceOrderId AND status = 'waiting_repair'
        `);
      if (!claimResult.rowsAffected[0]) {
        return null;
      }

      const desiredTasks = await buildDesiredTasks(tx, data.serviceOrderId);

      const headerResult = await tx
        .request()
        .input('serviceOrderId', sql.BigInt, data.serviceOrderId)
        .input('branchId', sql.BigInt, branchId)
        .input('teamLeaderId', sql.BigInt, teamLeaderId)
        .input('bayId', sql.BigInt, bayId)
        .input('vehicleId', sql.BigInt, data.vehicleId)
        .input('createdBy', sql.BigInt, createdBy)
        .input('status', sql.VarChar(20), 'inprogress')
        .query(`
          INSERT INTO repair_orders (
            repair_code, service_order_id, branch_id, team_leader_id, bay_id, vehicle_id,
            created_by, status, notes, created_at
          )
          VALUES (
            '', @serviceOrderId, @branchId, @teamLeaderId, @bayId, @vehicleId,
            @createdBy, @status, NULL, GETDATE()
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);

      const id = headerResult.recordset[0].id;
      await tx.request().input('id', sql.BigInt, id).input('code', sql.VarChar(30), genCode('LSC', id))
        .query(`UPDATE repair_orders SET repair_code = @code WHERE id = @id`);

      const insertTask = async ({ taskName, taskType, productId, quantity, unitPrice, note }) => {
        await tx
          .request()
          .input('repairOrderId', sql.BigInt, id)
          .input('taskName', sql.NVarChar(300), taskName)
          .input('taskType', sql.VarChar(10), taskType)
          .input('productId', sql.BigInt, productId || null)
          .input('quantity', sql.Int, quantity || 0)
          .input('unitPrice', sql.Decimal(18, 2), unitPrice || 0)
          .input('note', sql.NVarChar(500), note || null)
          .query(`
            INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done, note)
            VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0, @note)
          `);
      };
      for (const t of desiredTasks) {
        await insertTask(t);
      }

      return id;
    });

    return newId ? this.findById(newId) : null;
  }

  // Goi y tho may de gan vao lenh sua chua vua nhan - lay tho toan chi nhanh
  // (khong chi rieng doi cua to truong nay nua, de con "dieu dong" tho tu to
  // khac khi thieu nguoi), kem 2 co:
  //  - same_team: co thuoc dung doi cua to truong dang dang nhap khong (FE
  //    hien "(To khac - dieu dong)" khi = 0).
  //  - busy: co dang duoc gan cho 1 lenh sua chua KHAC con "inprogress"
  //    khong (FE chan khong cho chon tiep khi = 1).
  async searchTechnicians(teamLeaderId, branchId, search) {
    const result = await query(
      `SELECT TOP 20 u.id, u.user_name, u.phone,
              CASE WHEN u.team_leader_id = @teamLeaderId THEN 1 ELSE 0 END AS same_team,
              CASE WHEN EXISTS (
                SELECT 1 FROM repair_order_technicians rot
                JOIN repair_orders ro ON ro.id = rot.repair_order_id
                WHERE rot.technician_id = u.id AND ro.status = 'inprogress'
              ) THEN 1 ELSE 0 END AS busy
       FROM users u
       WHERE u.branch_id = @branchId
         AND EXISTS (
           SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.role_name = 'technician'
         )
         AND (@search IS NULL OR u.user_name LIKE @search)
       ORDER BY same_team DESC, busy ASC, u.user_name ASC`,
      { teamLeaderId, branchId, search: search ? `%${search.trim()}%` : null }
    );
    return result.recordset;
  }

  // Gan (thay the toan bo) danh sach tho thuc hien lenh sua chua - co the
  // nhieu tho cung sua 1 xe, ke ca tho "dieu dong" tu to khac (khong bat
  // buoc team_leader_id trung nua, chi can cung chi nhanh). Van chan khong
  // cho gan 1 tho dang "inprogress" o 1 lenh KHAC (ro2.id <> @id) - dung
  // validate lai luc chon xong, tranh truong hop danh sach goi y bi cu do
  // tho vua duoc lenh khac nhan mat luc dang go ten.
  async setTechnicians(id, teamLeaderId, branchId, technicianIds) {
    return runInTransaction(async (tx) => {
      const ownerCheck = await tx
        .request()
        .input('id', sql.BigInt, id)
        .input('teamLeaderId', sql.BigInt, teamLeaderId)
        .query(`SELECT 1 FROM repair_orders WHERE id = @id AND team_leader_id = @teamLeaderId`);
      if (!ownerCheck.recordset[0]) return false;

      if (technicianIds.length > 0) {
        const inClause = technicianIds.map((_, i) => `@tech${i}`).join(',');
        const req = tx.request().input('branchId', sql.BigInt, branchId).input('id', sql.BigInt, id);
        technicianIds.forEach((tid, i) => req.input(`tech${i}`, sql.BigInt, tid));
        const validCheck = await req.query(`
          SELECT COUNT(*) AS cnt FROM users u
          WHERE u.id IN (${inClause}) AND u.branch_id = @branchId
            AND EXISTS (
              SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.role_name = 'technician'
            )
            AND NOT EXISTS (
              SELECT 1 FROM repair_order_technicians rot
              JOIN repair_orders ro2 ON ro2.id = rot.repair_order_id
              WHERE rot.technician_id = u.id AND ro2.status = 'inprogress' AND ro2.id <> @id
            )
        `);
        if (validCheck.recordset[0].cnt !== technicianIds.length) return false;
      }

      await tx.request().input('id', sql.BigInt, id)
        .query(`DELETE FROM repair_order_technicians WHERE repair_order_id = @id`);

      for (const technicianId of technicianIds) {
        await tx
          .request()
          .input('id', sql.BigInt, id)
          .input('technicianId', sql.BigInt, technicianId)
          .query(`INSERT INTO repair_order_technicians (repair_order_id, technician_id) VALUES (@id, @technicianId)`);
      }

      return true;
    });
  }

  async updateTaskStatus(taskId, isDone) {
    await query('UPDATE repair_order_tasks SET is_done = @isDone WHERE id = @taskId', {
      taskId: Number(taskId),
      isDone: isDone ? 1 : 0,
    });
  }

  // Chi con dung cho status='completed' - huy lenh sua chua gio la mot chieu
  // (CVDV huy tu Phieu quyet toan, xem RepairSettlementRepositoryImpl.updateStatus
  // cascade sang bang nay), khong con duong nao goi truc tiep voi 'cancelled' nua.
  async updateStatus(id, status) {
    await runInTransaction(async (tx) => {
      await tx
        .request()
        .input('id', sql.BigInt, id)
        .input('status', sql.VarChar(20), status)
        .query(`UPDATE repair_orders SET status = @status, completed_at = GETDATE() WHERE id = @id`);

      // To truong bam Hoan thanh -> tu dong chuyen luon phieu quyet toan goc
      // sang "Cho thanh toan", co van khong phai vao bam Hoan thanh lan nua.
      // Chi cap nhat khi phieu quyet toan dang o trang thai "inprogress" (con
      // dang sua chua) de khong ghi de nham 1 phieu da huy/da xuat hoa don.
      if (status === 'completed') {
        await tx
          .request()
          .input('id', sql.BigInt, id)
          .query(`
            UPDATE so
            SET    so.status = 'waiting_payment',
                   so.completed_date = GETDATE()
            FROM   service_orders so
            JOIN   repair_orders ro ON ro.service_order_id = so.id
            WHERE  ro.id = @id AND so.status = 'inprogress'
          `);
      }
    });
    return this.findById(id);
  }
}

module.exports = RepairOrderRepositoryImpl;
