const RepairOrderRepository = require('../../domain/repositories/RepairOrderRepository');
const RepairOrder = require('../../domain/entities/RepairOrder');
const { query, sql, getPool } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { NOW_VN_SQL } = require('../../utils/dateVN');
const { buildDesiredTasks } = require('./repairOrderTaskBuilder');

// Repository nay phuc vu goc nhin TO TRUONG / KHOANG XE tren cung bang
// `repair_orders` ma RepairSettlementRepositoryImpl phuc vu goc nhin CVDV.
// Truoc day la 2 bang rieng (service_orders + repair_orders) voi 2 ma khac
// nhau; sau khi gop chi con 1 bang, 1 id, 1 ma RO - xem ensureRepairOrderMerge.
//
// Vi vay o day KHONG con join sang bang khac de lay khach hang/co van nua,
// tat ca da nam ngay tren dong phieu.
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
         adv.user_name  AS advisor_name,
         vb.bay_number  AS vb_bay_number
  FROM   repair_orders ro
  JOIN   branches b      ON b.id = ro.branch_id
  JOIN   users    tl     ON tl.id = ro.team_leader_id
  LEFT JOIN users creator ON creator.id = ro.repair_created_by
  LEFT JOIN vehicles v       ON v.id = ro.vehicle_id
  LEFT JOIN customers c      ON c.id = ro.customer_id
  LEFT JOIN users     adv    ON adv.id = ro.advisor_id
  LEFT JOIN vehicle_bays vb  ON vb.id = ro.bay_id
  OUTER APPLY (
      SELECT STRING_AGG(sp.specialty_name, ', ') AS names
      FROM   user_specialty us
      JOIN   specialties sp ON sp.id = us.specialty_id
      WHERE  us.user_id = tl.id
  ) tlspec
`;

// Goc nhin to truong chi quan tam phieu DA duoc nhan viec (da co to truong).
// Phieu con o 'waiting_repair' chua thuoc ve ai nen khong hien o day.
const CLAIMED_ONLY = `ro.team_leader_id IS NOT NULL AND ro.repair_started_at IS NOT NULL`;

// Dau muc phu tung phai hien ro DON VI TINH ("x4 Lít" chu khong phai "x4") -
// tho o khoang can biet do 4 lit dau hay lay 4 cai bugi. repair_order_tasks
// khong luu DVT (chi co so luong), nen lay tu kho qua product_id. Dich vu thi
// khong co product_id -> unit = NULL, FE tu bo qua.
const TASK_SELECT = `
  SELECT rot.*, u.unit_name AS unit
  FROM   repair_order_tasks rot
  LEFT   JOIN products p ON p.id = rot.product_id
  LEFT   JOIN units    u ON u.id = p.unit_id
`;

// Trang thai lenh sua chua truoc day la 1 cot rieng (inprogress/completed/
// cancelled) - that ra chi la anh xa 1-1 tu trang thai phieu, nen sau khi gop
// thi suy ra thay vi luu trung. Xem ensureRepairOrderMerge.
function repairStatusOf(row) {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'waiting_payment' || row.status === 'invoiced') return 'completed';
  return 'inprogress';
}

function toEntity(row, tasks = [], technicians = []) {
  return RepairOrder.fromPersistence({ ...row, repair_status: repairStatusOf(row) }, tasks, technicians);
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
    let sqlText = `${HEADER_SELECT} WHERE ro.branch_id = @branchId AND ${CLAIMED_ONLY}`;
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
      return rows.map((row) => toEntity(row, [], techniciansByOrder.get(row.id) || []));
    }

    const inClause = ids.map((_, i) => `@id${i}`).join(',');
    const taskParams = {};
    ids.forEach((rid, i) => { taskParams[`id${i}`] = rid; });
    const tasksResult = await query(
      `${TASK_SELECT} WHERE rot.repair_order_id IN (${inClause}) ORDER BY rot.id`,
      taskParams
    );
    const tasksByOrder = new Map();
    tasksResult.recordset.forEach((t) => {
      if (!tasksByOrder.has(t.repair_order_id)) tasksByOrder.set(t.repair_order_id, []);
      tasksByOrder.get(t.repair_order_id).push(t);
    });

    return rows.map((row) => toEntity(row, tasksByOrder.get(row.id) || [], techniciansByOrder.get(row.id) || []));
  }

  async findById(id) {
    const headerResult = await query(`${HEADER_SELECT} WHERE ro.id = @id`, { id });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const tasksResult = await query(
      `${TASK_SELECT} WHERE rot.repair_order_id = @id ORDER BY rot.id`,
      { id }
    );
    const techniciansByOrder = await fetchTechniciansByOrderIds([header.id]);
    return toEntity(header, tasksResult.recordset, techniciansByOrder.get(header.id) || []);
  }

  async findByCode(code) {
    const headerResult = await query(`${HEADER_SELECT} WHERE ro.repair_code = @code`, { code });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const tasksResult = await query(
      `${TASK_SELECT} WHERE rot.repair_order_id = @id ORDER BY rot.id`,
      { id: header.id }
    );
    const techniciansByOrder = await fetchTechniciansByOrderIds([header.id]);
    return toEntity(header, tasksResult.recordset, techniciansByOrder.get(header.id) || []);
  }

  // Public - dung cho Landing "Tra cuu tien do sua chua". Khach hang chi cam
  // DUY NHAT 1 ma tren tay: ma phieu `RO-YYYY-NNN`, cap ngay luc tiep nhan xe
  // va giu nguyen den luc xuat hoa don (truoc day con co them ma noi bo
  // "LSC-..." sinh ra luc to truong nhan viec, khach khong bao gio biet - da
  // bo han khi gop bang, xem ensureRepairOrderMerge).
  async findPublicProgressByCode(code) {
    const result = await query(
      `SELECT ro.id, ro.repair_code, ro.status, ro.intake_date, ro.repair_started_at,
              ro.repair_completed_at, b.branch_name
       FROM   repair_orders ro
       JOIN   branches b ON b.id = ro.branch_id
       WHERE  ro.repair_code = @code`,
      { code }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const base = {
      code: row.repair_code,
      branchName: row.branch_name,
      createdAt: row.intake_date,
      completedAt: null,
      tasks: [],
    };

    if (row.status === 'cancelled') {
      return { ...base, status: 'cancelled' };
    }

    // Da co to truong nhan viec -> danh sach dau muc THAT (repair_order_tasks),
    // co tick tien do.
    if (row.repair_started_at) {
      const tasksResult = await query(
        `SELECT task_name, task_type, is_done FROM repair_order_tasks WHERE repair_order_id = @id ORDER BY id`,
        { id: row.id }
      );
      return {
        ...base,
        status: repairStatusOf(row),
        completedAt: row.repair_completed_at,
        tasks: tasksResult.recordset.map((t) => ({
          taskName: t.task_name, taskType: t.task_type, isDone: Boolean(t.is_done),
        })),
      };
    }

    // Chua ai nhan viec - dung lai chinh logic suy ra checklist tu hang muc
    // phieu (buildDesiredTasks, giong het luc nhan viec that su) de lam danh
    // sach "sap toi" tam thoi, tat ca deu chua lam.
    const pool = await getPool();
    const desiredTasks = await buildDesiredTasks(pool, row.id);
    return {
      ...base,
      status: 'pending_assignment',
      tasks: desiredTasks.map((t) => ({ taskName: t.taskName, taskType: t.taskType, isDone: false })),
    };
  }

  async findEligibleRepairOrder(repairOrderId, branchId) {
    const result = await query(
      `SELECT ro.id, ro.branch_id, ro.status, ro.vehicle_id
       FROM   repair_orders ro
       WHERE  ro.id = @repairOrderId AND ro.branch_id = @branchId`,
      { repairOrderId, branchId }
    );
    return result.recordset[0] || null;
  }

  // Tho tu nhan viec qua khoang xe - UPDATE co dieu kien
  // "status='waiting_repair'" va kiem tra rowsAffected de phat hien 2 khoang
  // nhan trung 1 phieu cung luc (race) - thua thi rollback ca transaction,
  // tra ve null cho service bao 409.
  //
  // Truoc day buoc nay con INSERT them 1 dong `repair_orders` rieng kem ma
  // "LSC-..."; gio chi la cap nhat ngay tren phieu (team_leader_id, bay_id,
  // repair_started_at) - phieu giu nguyen ma RO tu dau den cuoi.
  async claim(repairOrderId, { branchId, teamLeaderId, bayId, createdBy }) {
    const ok = await runInTransaction(async (tx) => {
      const claimResult = await tx
        .request()
        .input('id', sql.BigInt, repairOrderId)
        .input('teamLeaderId', sql.BigInt, teamLeaderId)
        .input('bayId', sql.BigInt, bayId)
        .input('createdBy', sql.BigInt, createdBy)
        .query(`
          UPDATE repair_orders
          SET    team_leader_id = @teamLeaderId,
                 bay_id = @bayId,
                 repair_created_by = @createdBy,
                 repair_started_at = GETDATE(),
                 status = 'inprogress'
          WHERE  id = @id AND status = 'waiting_repair'
        `);
      if (!claimResult.rowsAffected[0]) return false;

      const desiredTasks = await buildDesiredTasks(tx, repairOrderId);

      // Nhan lai phieu tung bi tra ve 'waiting_repair' co the con dau muc cu -
      // xoa truoc de khong nhan doi danh sach.
      await tx.request().input('id', sql.BigInt, repairOrderId)
        .query(`DELETE FROM repair_order_tasks WHERE repair_order_id = @id`);

      for (const t of desiredTasks) {
        await tx
          .request()
          .input('repairOrderId', sql.BigInt, repairOrderId)
          .input('taskName', sql.NVarChar(300), t.taskName)
          .input('taskType', sql.VarChar(10), t.taskType)
          .input('productId', sql.BigInt, t.productId || null)
          .input('quantity', sql.Int, t.quantity || 0)
          .input('unitPrice', sql.Decimal(18, 2), t.unitPrice || 0)
          .input('note', sql.NVarChar(500), t.note || null)
          .input('actionCode', sql.VarChar(4), t.actionCode || null)
          .input('checklistGroup', sql.NVarChar(120), t.checklistGroup || null)
          .input('checklistOrder', sql.Int, t.checklistOrder ?? null)
          .query(`
            INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done, note, action_code, checklist_group, checklist_order)
            VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0, @note, @actionCode, @checklistGroup, @checklistOrder)
          `);
      }

      return true;
    });

    return ok ? this.findById(repairOrderId) : null;
  }

  // Goi y tho may de gan vao phieu vua nhan - lay tho toan chi nhanh (khong
  // chi rieng doi cua to truong nay, de con "dieu dong" tho tu to khac khi
  // thieu nguoi), kem 2 co:
  //  - same_team: co thuoc dung doi cua to truong dang dang nhap khong (FE
  //    hien "(To khac - dieu dong)" khi = 0).
  //  - busy: co dang duoc gan cho 1 phieu KHAC con dang sua khong (FE chan
  //    khong cho chon tiep khi = 1).
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

  // Gan (thay the toan bo) danh sach tho thuc hien - co the nhieu tho cung
  // sua 1 xe, ke ca tho "dieu dong" tu to khac (khong bat buoc team_leader_id
  // trung nua, chi can cung chi nhanh). Van chan khong cho gan 1 tho dang ban
  // o 1 phieu KHAC (ro2.id <> @id) - dung validate lai luc chon xong, tranh
  // truong hop danh sach goi y bi cu do tho vua duoc phieu khac nhan mat luc
  // dang go ten.
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

  // giuLichSuNg: dau muc "Khong dat" ma khach da dong y thay - tho dang tick
  // lai sau khi THAY XONG, khong phai cham ket qua kiem tra lan nua. Chi doi
  // is_done, giu nguyen check_result/check_note/ng_* lam lich su; neu ghi de
  // nhu binh thuong thi CASE WHEN ben duoi se xoa sach ca quyet dinh cua
  // khach lan ly do phai thay.
  async updateTaskStatus(taskId, isDone, { checkResult = null, checkNote = null, giuLichSuNg = false } = {}) {
    if (giuLichSuNg) {
      await query(
        `UPDATE repair_order_tasks SET is_done = @isDone WHERE id = @taskId`,
        { taskId: Number(taskId), isDone: isDone ? 1 : 0 }
      );
      return;
    }
    await query(
      // Cham "Khong dat" -> 'reported': tho DA BAO, dang cho TO TRUONG chuyen
      // len co van. Khong nhay thang 'pending' (= cho co van hoi khach) nua -
      // moi thu tu khoang phai qua to truong roi moi toi co van, ke ca viec
      // bao can thay the (xem forwardNgTask ben duoi).
      `UPDATE repair_order_tasks
       SET    is_done = @isDone, check_result = @checkResult, check_note = @checkNote,
              ng_decision = CASE WHEN @checkResult = 'NG' THEN 'reported' ELSE NULL END,
              ng_note = NULL, ng_decided_by = NULL, ng_decided_at = NULL
       WHERE  id = @taskId`,
      {
        taskId: Number(taskId),
        isDone: isDone ? 1 : 0,
        checkResult,
        checkNote,
      }
    );
  }

  // Chi con dung cho status='completed' - huy gio la mot chieu (CVDV huy tu
  // man Phieu quyet toan, xem RepairSettlementRepositoryImpl.updateStatus),
  // khong con duong nao goi truc tiep voi 'cancelled' nua.
  //
  // Truoc khi gop bang, buoc nay phai ghi 2 cho: bang lenh sua chua ('completed')
  // roi cascade sang phieu quyet toan ('waiting_payment'). Gio chi con 1 dong
  // UPDATE - trang thai lenh la suy ra tu trang thai phieu (xem repairStatusOf).
  // To truong chuyen 1 dau muc "Khong dat" len cho co van dich vu lien he
  // khach: 'reported' (tho vua bao) -> 'pending' (cho co van hoi khach).
  //
  // Dieu kien ng_decision = 'reported' vua chan bam 2 lan, vua chan chuyen
  // nham dau muc da co quyet dinh cua khach ('accepted'/'declined').
  async forwardNgTask(repairOrderId, taskId) {
    const result = await query(
      `UPDATE repair_order_tasks
       SET    ng_decision = 'pending'
       WHERE  id = @taskId AND repair_order_id = @repairOrderId
         AND  check_result = 'NG' AND ng_decision = 'reported'`,
      { taskId: Number(taskId), repairOrderId: Number(repairOrderId) }
    );
    return result.rowsAffected[0] > 0;
  }

  // To truong tu khac phuc luon 1 dau muc "Khong dat" ma KHONG phai hoi khach.
  //
  // Dau muc "I" cua bieu mau ghi "Kiem tra, DIEU CHINH hoac thay the neu can
  // thiet" - nghia la phan dieu chinh da nam trong gia goi bao duong. Siet lai
  // 1 con oc, chinh lai day curoa, chau them nuoc lam mat... thi khong phat
  // sinh dong nao, khong co gi de hoi khach. Chi khi phai THAY PHU TUNG (them
  // tien) moi bat buoc qua co van - xem forwardNgTask.
  //
  // check_result ve 'OK': sau khi dieu chinh thi dau muc dat that, cot KET QUA
  // cua bieu mau phai ghi Dat. Nhung ng_note (to truong da lam gi) va
  // check_note (ly do tho cham Khong dat) deu GIU LAI - khong duoc de mat dau
  // vet la dau muc nay tung co van de.
  //
  // Chi nhan tu 'reported'. Da chuyen len co van ('pending') thi thoi, luc do
  // co van co the dang goi khach roi - keo nguoc ve lam co van noi mot dang,
  // xuong lam mot neo.
  async resolveNgTask(repairOrderId, taskId, { note, userId }) {
    const result = await query(
      `UPDATE repair_order_tasks
       SET    ng_decision = 'resolved', ng_note = @note,
              ng_decided_by = @userId, ng_decided_at = ${NOW_VN_SQL},
              check_result = 'OK'
       WHERE  id = @taskId AND repair_order_id = @repairOrderId
         AND  check_result = 'NG' AND ng_decision = 'reported'`,
      {
        taskId: Number(taskId),
        repairOrderId: Number(repairOrderId),
        note: note || null,
        userId: Number(userId),
      }
    );
    return result.rowsAffected[0] > 0;
  }

  // To truong go tich 1 dau muc da hoan thanh = "tra ve lam lai". Ngoai viec
  // mo lai chinh dau muc do (xoa ca ket qua Dat/Khong dat da ghi, de tho danh
  // gia lai tu dau), con phai THU HOI moc khoang bao xong: lenh dang cho xac
  // nhan se quay ve "dang lam" de khoang tick tiep duoc - neu khong, lenh ket
  // cung (khoang khong tick duoc vi lenh khong con 'inprogress', to truong
  // cung khong xac nhan duoc vi con dau muc chua xong).
  //
  // 2 cau trong 1 transaction: mo dau muc va thu hoi moc phai cung song hoac
  // cung chet, khong duoc de lenh o trang thai nua voi.
  async reopenTask(repairOrderId, taskId) {
    const ok = await runInTransaction(async (tx) => {
      const result = await tx
        .request()
        .input('taskId', sql.BigInt, taskId)
        .input('repairOrderId', sql.BigInt, repairOrderId)
        .query(`
          UPDATE repair_order_tasks
          SET    is_done = 0, check_result = NULL, check_note = NULL,
                 ng_decision = NULL, ng_note = NULL, ng_decided_by = NULL, ng_decided_at = NULL
          WHERE  id = @taskId AND repair_order_id = @repairOrderId AND is_done = 1
        `);
      return result.rowsAffected[0] > 0;
    });

    return ok ? this.findById(repairOrderId) : null;
  }

  // To truong bam "Hoan thanh" -> ket thuc lenh: phieu quyet toan chuyen
  // 'waiting_payment' (CVDV thay "Chờ thanh toán") va khoang duoc giai phong.
  // Chi to truong lam duoc buoc nay - khoang xe (khong dang nhap) chi tick
  // dau muc, khong tu ket thuc lenh.
  async updateStatus(id, status) {
    if (status !== 'completed') {
      throw new Error(`updateStatus chi ho tro 'completed', nhan duoc '${status}'`);
    }
    await query(
      `UPDATE repair_orders
       SET    status = 'waiting_payment',
              completed_date = GETDATE(),
              repair_completed_at = GETDATE()
       WHERE  id = @id AND status = 'inprogress'`,
      { id }
    );
    return this.findById(id);
  }
}

module.exports = RepairOrderRepositoryImpl;
