const sql = require('mssql');
const ExportRequestRepository = require('../../domain/repositories/ExportRequestRepository');
const ExportRequest = require('../../domain/entities/ExportRequest');
const ExportRequestItem = require('../../domain/entities/ExportRequestItem');
const { query } = require('../database/sqlServer');
const ApiError = require('../../utils/ApiError');

// Chi con thao tac kho (xuat them / tra hang) khi Lenh sua chua CHUA chot -
// dung dung 2 trang thai ma CVDV con sua duoc phieu quyet toan (xem
// RepairSettlementService.update). Sang 'waiting_payment'/'invoiced'/
// 'cancelled' la khoa han, vi luc do so lieu phai chot de thu tien.
const EXPORTABLE_RO_STATUSES = ['waiting_repair', 'inprogress'];
const EXPORTABLE_RO_STATUS_SQL = `ro.status IN ('waiting_repair', 'inprogress')`;

/**
 * Loc chung cho findAll / count: branchId, status, repairOrderId, fromDate, toDate, search.
 * Truoc khi gop bang o day co 2 tham so rieng (repairOrderId cho bang lenh sua
 * chua, serviceOrderId cho phieu quyet toan) - gio chi con 1 vi ca 2 tro ve
 * cung mot dong, xem ensureRepairOrderMerge.
 *
 * Mac dinh CHI liet ke phieu DA XONG (RO da chot, khong con xuat/tra duoc
 * nua). Phieu cua RO dang lam van con thay doi tung ngay nen khong dua vao
 * danh sach nay - NV Kho thao tac chung qua man "Tao phieu xuat".
 * Truyen includeOpen=true de lay ca phieu dang lam (dung noi bo, vd tra cuu
 * theo repairOrderId).
 * @returns {Object} { whereSql, params }
 */
function buildExportRequestFilters({
  branchId,
  status,
  repairOrderId,
  fromDate,
  toDate,
  search,
  includeOpen = false,
} = {}) {
  const where = [];
  const params = {};

  if (!includeOpen) {
    where.push(`ro.status NOT IN ('waiting_repair', 'inprogress')`);
  }

  if (branchId !== undefined && branchId !== null) {
    where.push('er.branch_id = @branchId');
    params.branchId = branchId;
  }
  if (status) {
    where.push('er.status = @status');
    params.status = status;
  }
  if (repairOrderId) {
    where.push('er.repair_order_id = @repairOrderId');
    params.repairOrderId = repairOrderId;
  }
  if (fromDate) {
    where.push('er.created_at >= @fromDate');
    params.fromDate = fromDate;
  }
  if (toDate) {
    where.push('er.created_at < DATEADD(day, 1, CAST(@toDate AS date))');
    params.toDate = toDate;
  }
  if (search) {
    where.push(
      '(er.request_code LIKE @search OR er.notes LIKE @search OR ro.repair_code LIKE @search)'
    );
    params.search = `%${search}%`;
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

class ExportRequestRepositoryImpl extends ExportRequestRepository {
  async findAll({
    branchId,
    status,
    repairOrderId,
    fromDate,
    toDate,
    search,
    includeOpen,
    page = 1,
    limit = 20,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const { whereSql, params } = buildExportRequestFilters({
      branchId, status, repairOrderId, fromDate, toDate, search, includeOpen,
    });

    const sqlText = `
      SELECT
        er.*,
        ro.repair_code AS repair_order_code,
        c.full_name AS customer_name,
        v.license_plate AS vehicle_plate,
        COALESCE(NULLIF(LTRIM(RTRIM(u_perf.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_perf.first_name, N'') + N' ' + ISNULL(u_perf.last_name, N''))), N''), u_perf.pseudo_id) AS performed_by_name,
        COALESCE(NULLIF(LTRIM(RTRIM(u_recv.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_recv.first_name, N'') + N' ' + ISNULL(u_recv.last_name, N''))), N''), u_recv.pseudo_id) AS received_by_name,
        (SELECT COUNT(*) FROM export_request_items i WHERE i.export_request_id = er.id) AS item_count,
        (SELECT ISNULL(SUM(quantity), 0)
           FROM export_request_items i WHERE i.export_request_id = er.id) AS total_quantity
      FROM export_requests er
      LEFT JOIN repair_orders ro ON ro.id = er.repair_order_id
      LEFT JOIN customers c ON c.id = ro.customer_id
      LEFT JOIN vehicles v ON v.id = ro.vehicle_id
      LEFT JOIN users u_perf ON u_perf.id = er.performed_by
      LEFT JOIN users u_recv ON u_recv.id = er.received_by
      ${whereSql}
      ORDER BY er.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await query(sqlText, { ...params, offset, limit: safeLimit });
    return result.recordset.map((r) => ExportRequest.fromPersistence(r));
  }

  async count({
    branchId, status, repairOrderId, fromDate, toDate, search, includeOpen,
  } = {}) {
    const { whereSql, params } = buildExportRequestFilters({
      branchId, status, repairOrderId, fromDate, toDate, search, includeOpen,
    });
    const sqlText = `
      SELECT COUNT(*) AS total
      FROM export_requests er
      LEFT JOIN repair_orders ro ON ro.id = er.repair_order_id
      ${whereSql}
    `;
    const result = await query(sqlText, params);
    return result.recordset[0].total;
  }

  async findById(id) {
    const headerResult = await query(
      `SELECT
         er.*,
         ro.repair_code AS repair_order_code,
         c.full_name AS customer_name,
         v.license_plate AS vehicle_plate,
         COALESCE(NULLIF(LTRIM(RTRIM(u_perf.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_perf.first_name, N'') + N' ' + ISNULL(u_perf.last_name, N''))), N''), u_perf.pseudo_id) AS performed_by_name,
         COALESCE(NULLIF(LTRIM(RTRIM(u_recv.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_recv.first_name, N'') + N' ' + ISNULL(u_recv.last_name, N''))), N''), u_recv.pseudo_id) AS received_by_name
       FROM export_requests er
       LEFT JOIN repair_orders ro ON ro.id = er.repair_order_id
       LEFT JOIN customers c ON c.id = ro.customer_id
       LEFT JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN users u_perf ON u_perf.id = er.performed_by
       LEFT JOIN users u_recv ON u_recv.id = er.received_by
       WHERE er.id = @id`,
      { id }
    );
    const headerRow = headerResult.recordset[0];
    if (!headerRow) return null;

    const items = await this.findItemsByRequestId(id);
    const request = ExportRequest.fromPersistence(headerRow);
    request.items = items;
    return { request, items };
  }

  async findItemsByRequestId(exportRequestId) {
    const result = await query(
      `SELECT eri.id, eri.export_request_id, eri.product_id, eri.product_code,
              eri.product_name,
              CASE WHEN eri.unit IS NULL OR eri.unit LIKE N'%?%'
                   THEN COALESCE(NULLIF(u.unit_name, N''), eri.unit)
                   ELSE eri.unit END AS unit,
              eri.quantity
       FROM export_request_items eri
       LEFT JOIN products p ON p.id = eri.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE eri.export_request_id = @exportRequestId
       ORDER BY eri.id ASC`,
      { exportRequestId }
    );
    return result.recordset.map((r) => ExportRequestItem.fromPersistence(r));
  }

  /**
   * Lay Repair Order CON THAO TAC KHO DUOC. Khong con loai bo RO "da xuat
   * roi" nua: 1 RO chi co 1 phieu xuat nhung duoc xuat them/tra hang nhieu
   * lan cho den khi RO roi khoi waiting_repair/inprogress (xem
   * EXPORTABLE_RO_STATUS_SQL) - dung dung moc CVDV bi khoa sua phieu quyet
   * toan, de 2 ben khong lech nhau.
   */
  async findExportableRepairOrders({ branchId, search, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const where = [
      `ro.branch_id = @branchId`,
      EXPORTABLE_RO_STATUS_SQL,
    ];
    const params = { branchId };
    if (search) {
      where.push(
        '(ro.repair_code LIKE @search OR c.full_name LIKE @search OR v.license_plate LIKE @search)'
      );
      params.search = `%${search}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const sqlText = `
      SELECT
        ro.id,
        ro.repair_code AS repair_order_code,
        ro.status,
        ro.intake_date AS created_at,
        c.full_name AS customer_name,
        v.license_plate AS vehicle_plate,
        tl.user_name AS team_leader_name,
        (
          SELECT COUNT(*)
          FROM repair_order_tasks rot
          WHERE rot.repair_order_id = ro.id
            AND rot.task_type = 'product'
            AND rot.product_id IS NOT NULL
        ) AS part_task_count,
        (
          SELECT ISNULL(SUM(rot.quantity), 0)
          FROM repair_order_tasks rot
          WHERE rot.repair_order_id = ro.id
            AND rot.task_type = 'product'
            AND rot.product_id IS NOT NULL
        ) AS total_part_quantity,
        CAST(0 AS bit) AS already_exported
      FROM repair_orders ro
            LEFT JOIN customers c ON c.id = ro.customer_id
      LEFT JOIN vehicles v ON v.id = ro.vehicle_id
      LEFT JOIN users tl ON tl.id = ro.team_leader_id
      ${whereSql}
      ORDER BY ro.intake_date DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const result = await query(sqlText, { ...params, offset, limit: safeLimit });
    return result.recordset.map((r) => ({
      id: r.id,
      repairOrderCode: r.repair_order_code,
      status: r.status,
      createdAt: r.created_at,
      customerName: r.customer_name,
      vehiclePlate: r.vehicle_plate,
      teamLeaderName: r.team_leader_name,
      partTaskCount: r.part_task_count,
      totalPartQuantity: r.total_part_quantity,
      alreadyExported: r.already_exported === 1,
    }));
  }

  async countExportableRepairOrders({ branchId, search } = {}) {
    const where = [
      `ro.branch_id = @branchId`,
      EXPORTABLE_RO_STATUS_SQL,
    ];
    const params = { branchId };
    if (search) {
      where.push(
        '(ro.repair_code LIKE @search OR c.full_name LIKE @search OR v.license_plate LIKE @search)'
      );
      params.search = `%${search}%`;
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const sqlText = `
      SELECT COUNT(*) AS total
      FROM repair_orders ro
            LEFT JOIN customers c ON c.id = ro.customer_id
      LEFT JOIN vehicles v ON v.id = ro.vehicle_id
      ${whereSql}
    `;
    const result = await query(sqlText, params);
    return result.recordset[0].total;
  }

  /**
   * Danh sach tho may (dang hoat dong) cua 1 chi nhanh - dung cho dropdown
   * "Nguoi lay" khi NV Kho tao phieu xuat (ai chiu trach nhiem nhan phu tung).
   */
  async findTechnicians(branchId) {
    const result = await query(
      `SELECT u.id, u.pseudo_id,
              COALESCE(NULLIF(LTRIM(RTRIM(u.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u.first_name, N'') + N' ' + ISNULL(u.last_name, N''))), N''), u.pseudo_id) AS full_name
       FROM users u
       WHERE u.branch_id = @branchId
         AND u.status = 'active'
         AND EXISTS (
           SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.role_name = 'technician'
         )
       ORDER BY full_name ASC`,
      { branchId }
    );
    // employeeId (pseudo_id, vd "NV001") de phan biet cac tho TRUNG TEN nhau -
    // chi hien ten thi khong the tach duoc, vd co ca "nguyenson"/"Nguyen son".
    return result.recordset.map((r) => ({ id: r.id, employeeId: r.pseudo_id, fullName: r.full_name }));
  }

  /**
   * Lay 1 Repair Order kem TRANG THAI XUAT KHO cua tung phu tung.
   *
   * Moi dong tinh theo cong thuc: pending = yeu cau hien tai (tong
   * repair_order_tasks con hieu luc, gop theo product) - da xuat rong (tong
   * 'export' tru tong 'return' trong inventory_transactions cua RO nay).
   *   pending > 0 -> con phai xuat (lan dau: "Can xuat", da tung xuat:
   *                  "Xuat them"); thieu kho thi khong cho tick.
   *   pending < 0 -> CVDV da bot phu tung sau khi da xuat -> phai tra hang.
   *   pending = 0 -> xong, khong hien o tick.
   */
  async findRepairOrderForExport(repairOrderId) {
    const headerResult = await query(
      `SELECT
         ro.id,
         ro.repair_code AS repair_order_code,
         ro.status,
         c.full_name AS customer_name,
         v.license_plate AS vehicle_plate,
         tl.user_name AS team_leader_name,
         er.id AS export_request_id
       FROM repair_orders ro
              LEFT JOIN customers c ON c.id = ro.customer_id
       LEFT JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN users tl ON tl.id = ro.team_leader_id
       LEFT JOIN export_requests er ON er.repair_order_id = ro.id
       WHERE ro.id = @id`,
      { id: repairOrderId }
    );
    const header = headerResult.recordset[0];
    if (!header) return null;

    const itemsResult = await query(
      `WITH required AS (
         SELECT rot.product_id,
                SUM(rot.quantity) AS required_quantity
         FROM   repair_order_tasks rot
         WHERE  rot.repair_order_id = @id
           AND  rot.task_type = 'product'
           AND  rot.product_id IS NOT NULL
           AND  rot.is_cancelled = 0
         GROUP BY rot.product_id
       ),
       moved AS (
         SELECT it.product_id,
                SUM(CASE WHEN it.transaction_type = 'export' THEN it.quantity
                         WHEN it.transaction_type = 'return' THEN -it.quantity
                         ELSE 0 END) AS exported_quantity
         FROM   inventory_transactions it
         WHERE  it.repair_order_id = @id
           AND  it.transaction_type IN ('export', 'return')
           AND  it.status = 'completed'
         GROUP BY it.product_id
       )
       SELECT
         COALESCE(rq.product_id, mv.product_id) AS product_id,
         ISNULL(rq.required_quantity, 0) AS required_quantity,
         ISNULL(mv.exported_quantity, 0) AS exported_quantity,
         p.product_code,
         p.product_name,
         u.unit_name,
         p.stock_quantity AS current_stock
       FROM required rq
       FULL OUTER JOIN moved mv ON mv.product_id = rq.product_id
       LEFT JOIN products p ON p.id = COALESCE(rq.product_id, mv.product_id)
       LEFT JOIN units u ON u.id = p.unit_id
       ORDER BY p.product_code ASC`,
      { id: repairOrderId }
    );

    return {
      id: header.id,
      repairOrderCode: header.repair_order_code,
      status: header.status,
      customerName: header.customer_name,
      vehiclePlate: header.vehicle_plate,
      teamLeaderName: header.team_leader_name,
      exportRequestId: header.export_request_id ?? null,
      locked: !EXPORTABLE_RO_STATUSES.includes(header.status),
      items: itemsResult.recordset.map((r) => {
        const required = Number(r.required_quantity) || 0;
        const exported = Number(r.exported_quantity) || 0;
        const stock = Number(r.current_stock) || 0;
        const pending = required - exported;
        return {
          productId: r.product_id,
          productCode: r.product_code ?? '',
          productName: r.product_name ?? '',
          unit: r.unit_name ?? '',
          requiredQuantity: required,
          exportedQuantity: exported,
          currentStock: stock,
          // pending > 0: con phai xuat; < 0: phai tra lai kho; = 0: xong.
          pendingQuantity: pending,
          enoughStock: pending <= 0 || stock >= pending,
        };
      }),
    };
  }

  /**
   * Xac nhan 1 LAN lay hang (co the gom nhieu dong xuat va/hoac tra), tat ca
   * trong 1 transaction:
   *   1) Khoa RO, kiem tra con thao tac kho duoc khong.
   *   2) TU TINH LAI pending tung phu tung o server (KHONG tin so luong FE
   *      gui len - FE chi gui danh sach productId duoc tick).
   *   3) Tao header export_requests neu RO chua co (1 RO = 1 phieu duy nhat).
   *   4) Ghi 1 dong export_request_pickups (chu ky cua lan lay nay).
   *   5) Moi dong: cong/tru products.stock_quantity, cong don
   *      export_request_items.quantity, ghi inventory_transactions
   *      ('export' hoac 'return') gan pickup_id.
   *
   * @param {Object} tx
   * @param {Object} data - { branch_id, repair_order_id, performed_by,
   *                          received_by, signature_data, product_ids: [] }
   * @returns {Promise<{ request, items }>}
   */
  async confirmPickup(tx, data) {
    const { branch_id: branchId, repair_order_id: repairOrderId } = data;

    // 1) Khoa RO trong transaction + kiem tra trang thai.
    const roRow = (await tx.request()
      .input('repair_order_id', sql.BigInt, repairOrderId)
      .query(`
        SELECT ro.id, ro.repair_code, ro.status, er.id AS export_request_id
        FROM repair_orders ro WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN export_requests er ON er.repair_order_id = ro.id
        WHERE ro.id = @repair_order_id
      `)).recordset[0];
    if (!roRow) throw new ApiError(404, 'Khong tim thay lenh sua chua');
    if (!EXPORTABLE_RO_STATUSES.includes(roRow.status)) {
      throw new ApiError(409, 'Lenh sua chua da chot, khong the xuat/tra phu tung nua');
    }

    // 2) Tinh lai pending o server cho dung cac productId duoc tick.
    // Chi giu so nguyen duong - idList duoc noi thang vao cau SQL nen tuyet
    // doi khong duoc de lot gia tri la vao day.
    const productIds = [...new Set((data.product_ids || []).map(Number))]
      .filter((n) => Number.isInteger(n) && n > 0);
    if (productIds.length === 0) {
      throw new ApiError(400, 'Chua chon dong phu tung nao de xac nhan');
    }
    const idList = productIds.join(',');
    const pendingRows = (await tx.request()
      .input('repair_order_id', sql.BigInt, repairOrderId)
      .input('branch_id', sql.BigInt, branchId)
      .query(`
        WITH required AS (
          SELECT rot.product_id, SUM(rot.quantity) AS required_quantity
          FROM   repair_order_tasks rot
          WHERE  rot.repair_order_id = @repair_order_id
            AND  rot.task_type = 'product'
            AND  rot.product_id IS NOT NULL
            AND  rot.is_cancelled = 0
          GROUP BY rot.product_id
        ),
        moved AS (
          SELECT it.product_id,
                 SUM(CASE WHEN it.transaction_type = 'export' THEN it.quantity
                          WHEN it.transaction_type = 'return' THEN -it.quantity
                          ELSE 0 END) AS exported_quantity
          FROM   inventory_transactions it
          WHERE  it.repair_order_id = @repair_order_id
            AND  it.transaction_type IN ('export', 'return')
            AND  it.status = 'completed'
          GROUP BY it.product_id
        )
        SELECT COALESCE(rq.product_id, mv.product_id) AS product_id,
               ISNULL(rq.required_quantity, 0) - ISNULL(mv.exported_quantity, 0) AS pending_quantity,
               p.product_code, p.product_name, u.unit_name,
               p.stock_quantity AS current_stock
        FROM required rq
        FULL OUTER JOIN moved mv ON mv.product_id = rq.product_id
        LEFT JOIN products p WITH (UPDLOCK) ON p.id = COALESCE(rq.product_id, mv.product_id)
                                           AND p.branch_id = @branch_id
        LEFT JOIN units u ON u.id = p.unit_id
        WHERE COALESCE(rq.product_id, mv.product_id) IN (${idList})
      `)).recordset;

    const lines = pendingRows
      .map((r) => ({
        productId: Number(r.product_id),
        productCode: r.product_code,
        productName: r.product_name,
        unit: r.unit_name ?? null,
        pending: Number(r.pending_quantity) || 0,
        stock: Number(r.current_stock) || 0,
      }))
      .filter((l) => l.pending !== 0);

    if (lines.length === 0) {
      throw new ApiError(409, 'Cac dong da chon khong con gi de xuat hoac tra');
    }
    for (const l of lines) {
      if (l.pending > 0 && l.stock < l.pending) {
        throw new ApiError(
          409,
          `Ton kho khong du cho phu tung ${l.productCode} (con ${l.stock}, can xuat ${l.pending})`
        );
      }
    }

    // 3) Header: 1 RO = 1 phieu, tao lan dau roi dung lai mai.
    let exportRequestId = roRow.export_request_id;
    if (!exportRequestId) {
      exportRequestId = (await tx.request()
        .input('request_code', sql.VarChar(30), roRow.repair_code)
        .input('branch_id', sql.BigInt, branchId)
        .input('repair_order_id', sql.BigInt, repairOrderId)
        .input('performed_by', sql.BigInt, data.performed_by)
        .query(`
          INSERT INTO export_requests (
            request_code, branch_id, repair_order_id, performed_by,
            export_date, status, created_at
          )
          OUTPUT INSERTED.id
          VALUES (
            @request_code, @branch_id, @repair_order_id, @performed_by,
            CAST(GETDATE() AS DATE), 'completed', GETDATE()
          )
        `)).recordset[0].id;
    }

    // Header luon giu chu ky/nguoi lay cua LAN GAN NHAT (lich su day du nam
    // o export_request_pickups).
    await tx.request()
      .input('id', sql.BigInt, exportRequestId)
      .input('received_by', sql.BigInt, data.received_by)
      .input('signature_data', sql.NVarChar(sql.MAX), data.signature_data)
      .query(`
        UPDATE export_requests
        SET received_by = @received_by,
            received_signature_data = @signature_data,
            received_signed_at = GETDATE()
        WHERE id = @id
      `);

    // 4) Ghi 1 lan lay hang (chu ky rieng cua lan nay).
    const pickupId = (await tx.request()
      .input('export_request_id', sql.BigInt, exportRequestId)
      .input('received_by', sql.BigInt, data.received_by)
      .input('signature_data', sql.NVarChar(sql.MAX), data.signature_data)
      .input('performed_by', sql.BigInt, data.performed_by)
      .query(`
        INSERT INTO export_request_pickups (
          export_request_id, received_by, signature_data, signed_at, performed_by, created_at
        )
        OUTPUT INSERTED.id
        VALUES (@export_request_id, @received_by, @signature_data, GETDATE(), @performed_by, GETDATE())
      `)).recordset[0].id;

    // 5) Cong/tru kho + cong don item + ghi so giao dich.
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const txPrefix = `IT-${branchId}-${dateKey}-`;
    const seqRow = (await tx.request()
      .input('pattern', sql.VarChar(40), `${txPrefix}%`)
      .query(`
        SELECT TOP 1 transaction_code
        FROM inventory_transactions WITH (UPDLOCK, HOLDLOCK)
        WHERE transaction_code LIKE @pattern
        ORDER BY transaction_code DESC
      `)).recordset[0];
    let nextSeq = 1;
    if (seqRow) {
      const lastSeq = parseInt(seqRow.transaction_code.substring(txPrefix.length), 10);
      if (Number.isFinite(lastSeq)) nextSeq = lastSeq + 1;
    }

    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const isReturn = l.pending < 0;
      const moveQty = Math.abs(l.pending);
      // Xuat -> tru kho; tra hang -> cong lai kho. Guard >= 0 ngay trong WHERE
      // de khong bao gio am kho du co race.
      const delta = isReturn ? moveQty : -moveQty;
      const stockUpdate = await tx.request()
        .input('product_id', sql.BigInt, l.productId)
        .input('branch_id', sql.BigInt, branchId)
        .input('delta', sql.Int, delta)
        .query(`
          UPDATE products
          SET stock_quantity = stock_quantity + @delta
          WHERE id = @product_id AND branch_id = @branch_id
            AND stock_quantity + @delta >= 0
        `);
      if (stockUpdate.rowsAffected[0] !== 1) {
        throw new ApiError(409, `Ton kho khong du cho phu tung ${l.productCode}`);
      }

      // Cong don so luong da xuat rong tren phieu (co thi cong them, chua co thi tao).
      const itemUpdate = await tx.request()
        .input('export_request_id', sql.BigInt, exportRequestId)
        .input('product_id', sql.BigInt, l.productId)
        .input('quantity', sql.Int, isReturn ? -moveQty : moveQty)
        .query(`
          UPDATE export_request_items
          SET quantity = quantity + @quantity
          WHERE export_request_id = @export_request_id AND product_id = @product_id
        `);
      if (itemUpdate.rowsAffected[0] === 0) {
        await tx.request()
          .input('export_request_id', sql.BigInt, exportRequestId)
          .input('product_id', sql.BigInt, l.productId)
          .input('product_code', sql.VarChar(30), l.productCode)
          .input('product_name', sql.NVarChar(200), l.productName)
          .input('unit', sql.NVarChar(20), l.unit)
          .input('quantity', sql.Int, isReturn ? -moveQty : moveQty)
          .query(`
            INSERT INTO export_request_items (
              export_request_id, product_id, product_code, product_name, unit, quantity
            )
            VALUES (
              @export_request_id, @product_id, @product_code, @product_name, @unit, @quantity
            )
          `);
      }

      const txCode = `${txPrefix}${String(nextSeq + i).padStart(4, '0')}`;
      await tx.request()
        .input('transaction_code', sql.VarChar(30), txCode)
        .input('transaction_type', sql.VarChar(10), isReturn ? 'return' : 'export')
        .input('branch_id', sql.BigInt, branchId)
        .input('product_id', sql.BigInt, l.productId)
        .input('quantity', sql.Int, moveQty)
        .input('export_request_id', sql.BigInt, exportRequestId)
        .input('repair_order_id', sql.BigInt, repairOrderId)
        .input('pickup_id', sql.BigInt, pickupId)
        .input('performed_by', sql.BigInt, data.performed_by)
        .input('note', sql.NVarChar(500), `${isReturn ? 'Tra hang' : 'Xuat kho'} theo phieu ${roRow.repair_code}`)
        .query(`
          INSERT INTO inventory_transactions (
            transaction_code, transaction_type, branch_id, product_id,
            quantity, export_request_id, repair_order_id, pickup_id, performed_by,
            transaction_date, status, notes
          )
          VALUES (
            @transaction_code, @transaction_type, @branch_id, @product_id,
            @quantity, @export_request_id, @repair_order_id, @pickup_id, @performed_by,
            GETDATE(), 'completed', @note
          )
        `);
    }

    const headerRow = (await tx.request()
      .input('id', sql.BigInt, exportRequestId)
      .query(`SELECT * FROM export_requests WHERE id = @id`)).recordset[0];
    const itemsRows = (await tx.request()
      .input('id', sql.BigInt, exportRequestId)
      .query(`
        SELECT id, export_request_id, product_id, product_code, product_name, unit, quantity
        FROM export_request_items
        WHERE export_request_id = @id
        ORDER BY id ASC
      `)).recordset;

    return {
      request: ExportRequest.fromPersistence(headerRow),
      items: itemsRows.map((r) => ExportRequestItem.fromPersistence(r)),
    };
  }

  /**
   * Lich su cac lan lay hang / tra hang cua 1 phieu xuat (kem chu ky tung lan
   * va chi tiet phu tung cua lan do).
   */
  async findPickups(exportRequestId) {
    const result = await query(
      `SELECT
         pk.id, pk.signed_at, pk.signature_data,
         COALESCE(NULLIF(LTRIM(RTRIM(u.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u.first_name, N'') + N' ' + ISNULL(u.last_name, N''))), N''), u.pseudo_id) AS received_by_name,
         u.pseudo_id AS received_by_code,
         it.transaction_type, it.quantity,
         it.product_id, p.product_code, p.product_name, un.unit_name
       FROM export_request_pickups pk
       LEFT JOIN users u ON u.id = pk.received_by
       LEFT JOIN inventory_transactions it ON it.pickup_id = pk.id
       LEFT JOIN products p ON p.id = it.product_id
       LEFT JOIN units un ON un.id = p.unit_id
       WHERE pk.export_request_id = @id
       ORDER BY pk.id ASC, it.id ASC`,
      { id: exportRequestId }
    );

    const byPickup = new Map();
    for (const r of result.recordset) {
      if (!byPickup.has(r.id)) {
        byPickup.set(r.id, {
          id: r.id,
          signedAt: r.signed_at,
          signatureData: r.signature_data,
          receivedByName: r.received_by_name,
          receivedByCode: r.received_by_code,
          lines: [],
        });
      }
      if (r.product_id) {
        byPickup.get(r.id).lines.push({
          productId: r.product_id,
          productCode: r.product_code,
          productName: r.product_name,
          unit: r.unit_name,
          quantity: Number(r.quantity) || 0,
          type: r.transaction_type,
        });
      }
    }
    return [...byPickup.values()];
  }

  /**
   * Danh dau 1 phieu xuat la "da xem" boi Manager (dung cho thong bao dom).
   */
  async markSeenByManager(id) {
    await query(
      `UPDATE export_requests SET seen_by_manager_at = GETDATE() WHERE id = @id AND seen_by_manager_at IS NULL`,
      { id }
    );
  }

  /**
   * Dem so phieu xuat chua duoc Manager xem (dung cho badge do tren Navbar).
   */
  async countNewForManager(branchId) {
    const result = await query(
      `SELECT COUNT(*) AS total FROM export_requests WHERE branch_id = @branchId AND seen_by_manager_at IS NULL`,
      { branchId }
    );
    return result.recordset[0].total;
  }
}

module.exports = ExportRequestRepositoryImpl;
