const sql = require('mssql');
const ExportRequestRepository = require('../../domain/repositories/ExportRequestRepository');
const ExportRequest = require('../../domain/entities/ExportRequest');
const ExportRequestItem = require('../../domain/entities/ExportRequestItem');
const { query } = require('../database/sqlServer');
const ApiError = require('../../utils/ApiError');

/**
 * Loc chung cho findAll / count: branchId, status, repairOrderId, fromDate, toDate, search.
 * Truoc khi gop bang o day co 2 tham so rieng (repairOrderId cho bang lenh sua
 * chua, serviceOrderId cho phieu quyet toan) - gio chi con 1 vi ca 2 tro ve
 * cung mot dong, xem ensureRepairOrderMerge.
 * @returns {Object} { whereSql, params }
 */
function buildExportRequestFilters({
  branchId,
  status,
  repairOrderId,
  fromDate,
  toDate,
  search,
} = {}) {
  const where = [];
  const params = {};

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
    page = 1,
    limit = 20,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const { whereSql, params } = buildExportRequestFilters({
      branchId, status, repairOrderId, fromDate, toDate, search,
    });

    const sqlText = `
      SELECT
        er.*,
        ro.repair_code AS repair_order_code,
        c.full_name AS customer_name,
        v.license_plate AS vehicle_plate,
        COALESCE(NULLIF(LTRIM(RTRIM(u_perf.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_perf.first_name, N'') + N' ' + ISNULL(u_perf.last_name, N''))), N''), u_perf.pseudo_id) AS performed_by_name,
        (SELECT COUNT(*) FROM export_request_items i WHERE i.export_request_id = er.id) AS item_count,
        (SELECT ISNULL(SUM(quantity), 0)
           FROM export_request_items i WHERE i.export_request_id = er.id) AS total_quantity
      FROM export_requests er
      LEFT JOIN repair_orders ro ON ro.id = er.repair_order_id
      LEFT JOIN customers c ON c.id = ro.customer_id
      LEFT JOIN vehicles v ON v.id = ro.vehicle_id
      LEFT JOIN users u_perf ON u_perf.id = er.performed_by
      ${whereSql}
      ORDER BY er.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await query(sqlText, { ...params, offset, limit: safeLimit });
    return result.recordset.map((r) => ExportRequest.fromPersistence(r));
  }

  async count({
    branchId, status, repairOrderId, fromDate, toDate, search,
  } = {}) {
    const { whereSql, params } = buildExportRequestFilters({
      branchId, status, repairOrderId, fromDate, toDate, search,
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
         COALESCE(NULLIF(LTRIM(RTRIM(u_perf.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_perf.first_name, N'') + N' ' + ISNULL(u_perf.last_name, N''))), N''), u_perf.pseudo_id) AS performed_by_name
       FROM export_requests er
       LEFT JOIN repair_orders ro ON ro.id = er.repair_order_id
       LEFT JOIN customers c ON c.id = ro.customer_id
       LEFT JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN users u_perf ON u_perf.id = er.performed_by
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
   * Sinh ma phieu: EXB-{branchId}-{YYYYMMDD}-{sequence:4}.
   */
  async getNextRequestCode(branchId, date) {
    const d = date instanceof Date ? date : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const prefix = `EXB-${branchId}-${dateKey}-`;

    const result = await query(
      `SELECT TOP 1 request_code
       FROM export_requests
       WHERE request_code LIKE @pattern
       ORDER BY request_code DESC`,
      { pattern: `${prefix}%` }
    );
    let sequence = 1;
    if (result.recordset[0]) {
      const lastCode = result.recordset[0].request_code;
      const lastSeq = parseInt(lastCode.substring(prefix.length), 10);
      if (Number.isFinite(lastSeq)) sequence = lastSeq + 1;
    }
    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Lay Repair Order co the xuat kho (status <> 'cancelled', bao gom ca
   * 'inprogress' va 'completed' - phu tung co the phat sinh/chua xuat du
   * lenh da hoan thanh) va chua tung duoc xuat.
   */
  async findExportableRepairOrders({ branchId, search, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const where = [
      `ro.branch_id = @branchId`,
      `ro.status <> 'cancelled'`,
      `NOT EXISTS (
        SELECT 1 FROM export_requests er
        WHERE er.repair_order_id = ro.id
          AND er.status = 'completed'
      )`,
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
      `ro.status <> 'cancelled'`,
      `NOT EXISTS (
        SELECT 1 FROM export_requests er
        WHERE er.repair_order_id = ro.id
          AND er.status = 'completed'
      )`,
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
   * Lay 1 Repair Order kem cac phu tung (task_type='product') de hien thi trong form xuat.
   * Tra ve kem stock_quantity hien tai de FE check truoc khi submit.
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
        CASE WHEN EXISTS (
          SELECT 1 FROM export_requests er
          WHERE er.repair_order_id = ro.id
            AND er.status = 'completed'
        ) THEN 1 ELSE 0 END AS already_exported
       FROM repair_orders ro
              LEFT JOIN customers c ON c.id = ro.customer_id
       LEFT JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN users tl ON tl.id = ro.team_leader_id
       WHERE ro.id = @id`,
      { id: repairOrderId }
    );
    const header = headerResult.recordset[0];
    if (!header) return null;

    const itemsResult = await query(
      `SELECT
         rot.id AS repair_task_id,
         rot.product_id,
         rot.task_name AS product_name,
         rot.quantity AS requested_quantity,
         rot.unit_price,
         p.product_code AS current_product_code,
         p.product_name AS current_product_name,
         u.unit_name AS current_unit,
         p.stock_quantity AS current_stock
       FROM repair_order_tasks rot
       LEFT JOIN products p ON p.id = rot.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE rot.repair_order_id = @id
         AND rot.task_type = 'product'
         AND rot.product_id IS NOT NULL
       ORDER BY rot.id ASC`,
      { id: repairOrderId }
    );

    return {
      id: header.id,
      repairOrderCode: header.repair_order_code,
      status: header.status,
      customerName: header.customer_name,
      vehiclePlate: header.vehicle_plate,
      teamLeaderName: header.team_leader_name,
      alreadyExported: header.already_exported === 1,
      items: itemsResult.recordset.map((r) => ({
        repairTaskId: r.repair_task_id,
        productId: r.product_id,
        productCode: r.current_product_code ?? '',
        productName: r.current_product_name ?? r.product_name,
        unit: r.current_unit ?? '',
        requestedQuantity: r.requested_quantity,
        unitPrice: r.unit_price,
        currentStock: r.current_stock ?? 0,
      })),
    };
  }

  /**
   * Tao phieu xuat (transaction):
   *   1) INSERT export_requests (status='completed')
   *   2) INSERT export_request_items (snapshot phu tung)
   *   3) Cho moi item: CHECK stock >= quantity, sau do UPDATE products.stock_quantity -= quantity
   *   4) Cho moi item: INSERT inventory_transactions (transaction_type='export')
   * Neu stock khong du o bat ky item nao -> throw 409, rollback toan bo.
   *
   * Tra ve { request, items } de service sinh response DTO.
   */
  async create(tx, requestData, items) {
    const existingExport = await tx.request()
      .input('repair_order_id', sql.BigInt, requestData.repair_order_id)
      .query(`
        SELECT TOP 1 er.id
        FROM export_requests er WITH (UPDLOCK, HOLDLOCK)
        JOIN repair_orders ro ON ro.id = @repair_order_id
        WHERE er.repair_order_id = @repair_order_id
          AND er.status = 'completed'
      `);
    if (existingExport.recordset.length > 0) {
      throw new ApiError(409, 'Lenh sua chua nay da duoc xuat kho');
    }

    // 1) Insert header (repair_order_id, khong con repair_order_id)
    const insertReq = await tx.request()
      .input('request_code', sql.VarChar(30), requestData.request_code)
      .input('branch_id', sql.BigInt, requestData.branch_id)
      .input('repair_order_id', sql.BigInt, requestData.repair_order_id)
      .input('repair_order_id', sql.BigInt, requestData.repair_order_id ?? null)
      .input('performed_by', sql.BigInt, requestData.performed_by)
      .input('export_date', sql.Date, requestData.export_date ?? new Date())
      .input('notes', sql.NVarChar(500), requestData.notes ?? null)
      .query(`
        INSERT INTO export_requests (
          request_code, branch_id, repair_order_id, repair_order_id,
          performed_by, export_date, status, notes, created_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @request_code, @branch_id, @repair_order_id, @repair_order_id,
          @performed_by, @export_date, 'completed', @notes, GETDATE()
        )
      `);
    const newId = insertReq.recordset[0].id;

    // 2) Insert items (snapshot)
    for (const item of items) {
      await tx.request()
        .input('export_request_id', sql.BigInt, newId)
        .input('product_id', sql.BigInt, item.product_id ?? null)
        .input('product_code', sql.VarChar(30), item.product_code)
        .input('product_name', sql.NVarChar(200), item.product_name)
        .input('unit', sql.NVarChar(20), item.unit ?? null)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          INSERT INTO export_request_items (
            export_request_id, product_id, product_code, product_name, unit, quantity
          )
          VALUES (
            @export_request_id, @product_id, @product_code, @product_name, @unit, @quantity
          )
        `);
    }

    // 3) + 4) Tru stock + ghi log (co kiem tra stock)
    const branchId = requestData.branch_id;
    const dateKey = (requestData.export_date ?? new Date()).toISOString()
      ? new Date(requestData.export_date ?? new Date()).toISOString().slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const txPrefix = `IT-${branchId}-${dateKey}-`;

    // Lay sequence tiep theo de sinh transaction_code.
    const seqRow = (await tx.request()
      .input('pattern', sql.VarChar(40), `${txPrefix}%`)
      .query(`
        SELECT TOP 1 transaction_code
        FROM inventory_transactions
        WHERE transaction_code LIKE @pattern
        ORDER BY transaction_code DESC
      `)).recordset[0];
    let nextSeq = 1;
    if (seqRow) {
      const lastSeq = parseInt(seqRow.transaction_code.substring(txPrefix.length), 10);
      if (Number.isFinite(lastSeq)) nextSeq = lastSeq + 1;
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];

      // Check stock truoc khi tru (khoa row, neu khong du -> throw 409)
      const stockRow = (await tx.request()
        .input('product_id', sql.BigInt, item.product_id)
        .input('branch_id', sql.BigInt, branchId)
        .query(`
          SELECT stock_quantity
          FROM products
          WHERE id = @product_id AND branch_id = @branch_id
        `)).recordset[0];

      if (!stockRow) {
        throw new ApiError(404, `Phu tung ${item.product_code} khong ton tai trong chi nhanh`);
      }
      const currentStock = Number(stockRow.stock_quantity) || 0;
      if (currentStock < item.quantity) {
        throw new ApiError(
          409,
          `Ton kho khong du cho phu tung ${item.product_code} (con ${currentStock}, can xuat ${item.quantity})`
        );
      }

      // Tru stock
      await tx.request()
        .input('product_id', sql.BigInt, item.product_id)
        .input('branch_id', sql.BigInt, branchId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          UPDATE products
          SET stock_quantity = stock_quantity - @quantity
          WHERE id = @product_id AND branch_id = @branch_id
        `);

      // Ghi inventory_transactions (export)
      const txCode = `${txPrefix}${String(nextSeq + i).padStart(4, '0')}`;
      await tx.request()
        .input('transaction_code', sql.VarChar(30), txCode)
        .input('branch_id', sql.BigInt, branchId)
        .input('product_id', sql.BigInt, item.product_id)
        .input('quantity', sql.Int, item.quantity)
        .input('export_request_id', sql.BigInt, newId)
        .input('performed_by', sql.BigInt, requestData.performed_by)
        .input('request_code', sql.VarChar(30), requestData.request_code)
        .query(`
          INSERT INTO inventory_transactions (
            transaction_code, transaction_type, branch_id, product_id,
            quantity, export_request_id, performed_by,
            transaction_date, status, notes
          )
          VALUES (
            @transaction_code, 'export', @branch_id, @product_id,
            @quantity, @export_request_id, @performed_by,
            GETDATE(), 'completed',
            'Xuat kho theo phieu ' + @request_code
          )
        `);
    }

    // Lay lai header + items de tra ve
    const headerRow = (await tx.request()
      .input('id', sql.BigInt, newId)
      .query(`SELECT * FROM export_requests WHERE id = @id`)).recordset[0];
    const itemsRows = (await tx.request()
      .input('id', sql.BigInt, newId)
      .query(`
        SELECT id, export_request_id, product_id, product_code, product_name, unit, quantity
        FROM export_request_items
        WHERE export_request_id = @id
        ORDER BY id ASC
      `)).recordset;

    const request = ExportRequest.fromPersistence(headerRow);
    const itemEntities = itemsRows.map((r) => ExportRequestItem.fromPersistence(r));
    return { request, items: itemEntities };
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
