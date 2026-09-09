const sql = require('mssql');
const ImportRequestRepository = require('../../domain/repositories/ImportRequestRepository');
const ImportRequest = require('../../domain/entities/ImportRequest');
const ImportRequestItem = require('../../domain/entities/ImportRequestItem');
const ApiError = require('../../utils/ApiError');
const { query } = require('../database/sqlServer');

/**
 * Loc chung cho findAll / count: branchId, status, supplierId, fromDate, toDate, search.
 * @returns {Object} { whereSql, params }
 */
function buildImportRequestFilters({
  branchId,
  status,
  supplierId,
  fromDate,
  toDate,
  search,
} = {}) {
  const where = [];
  const params = {};

  if (branchId !== undefined && branchId !== null) {
    where.push('ir.branch_id = @branchId');
    params.branchId = branchId;
  }
  if (status) {
    where.push('ir.status = @status');
    params.status = status;
  }
  if (supplierId) {
    where.push('ir.supplier_id = @supplierId');
    params.supplierId = supplierId;
  }
  if (fromDate) {
    where.push('ir.created_at >= @fromDate');
    params.fromDate = fromDate;
  }
  if (toDate) {
    where.push('ir.created_at < DATEADD(day, 1, CAST(@toDate AS date))');
    params.toDate = toDate;
  }
  if (search) {
    where.push('(ir.request_code LIKE @search OR ir.notes LIKE @search)');
    params.search = `%${search}%`;
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

class ImportRequestRepositoryImpl extends ImportRequestRepository {
  async findAll({
    branchId,
    status,
    supplierId,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const { whereSql, params } = buildImportRequestFilters({
      branchId, status, supplierId, fromDate, toDate, search,
    });

    const sqlText = `
      SELECT
        ir.*,
        s.supplier_name,
        COALESCE(NULLIF(LTRIM(RTRIM(u_req.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_req.first_name, N'') + N' ' + ISNULL(u_req.last_name, N''))), N''), u_req.pseudo_id) AS requested_by_name,
        COALESCE(NULLIF(LTRIM(RTRIM(u_apv.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_apv.first_name, N'') + N' ' + ISNULL(u_apv.last_name, N''))), N''), u_apv.pseudo_id) AS approved_by_name,
        (SELECT COUNT(*) FROM import_request_items i WHERE i.import_request_id = ir.id) AS item_count,
        (SELECT ISNULL(SUM(quantity), 0)
           FROM import_request_items i WHERE i.import_request_id = ir.id) AS total_quantity
      FROM import_requests ir
      LEFT JOIN suppliers s ON s.id = ir.supplier_id
      LEFT JOIN users u_req ON u_req.id = ir.requested_by
      LEFT JOIN users u_apv ON u_apv.id = ir.approved_by
      ${whereSql}
      ORDER BY ir.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await query(sqlText, { ...params, offset, limit: safeLimit });
    return result.recordset.map((r) => ImportRequest.fromPersistence(r));
  }

  async count({
    branchId, status, supplierId, fromDate, toDate, search,
  } = {}) {
    const { whereSql, params } = buildImportRequestFilters({
      branchId, status, supplierId, fromDate, toDate, search,
    });
    const sqlText = `SELECT COUNT(*) AS total FROM import_requests ir ${whereSql}`;
    const result = await query(sqlText, params);
    return result.recordset[0].total;
  }

  async findById(id, { branchId } = {}) {
    const headerResult = await query(
      `SELECT
         ir.*,
         s.supplier_name,
         COALESCE(NULLIF(LTRIM(RTRIM(u_req.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_req.first_name, N'') + N' ' + ISNULL(u_req.last_name, N''))), N''), u_req.pseudo_id) AS requested_by_name,
         COALESCE(NULLIF(LTRIM(RTRIM(u_apv.user_name)), N''), NULLIF(LTRIM(RTRIM(ISNULL(u_apv.first_name, N'') + N' ' + ISNULL(u_apv.last_name, N''))), N''), u_apv.pseudo_id) AS approved_by_name
       FROM import_requests ir
       LEFT JOIN suppliers s ON s.id = ir.supplier_id
       LEFT JOIN users u_req ON u_req.id = ir.requested_by
       LEFT JOIN users u_apv ON u_apv.id = ir.approved_by
       WHERE ir.id = @id
         AND (@branchId IS NULL OR ir.branch_id = @branchId)`,
      { id, branchId: branchId == null ? null : Number(branchId) }
    );
    const headerRow = headerResult.recordset[0];
    if (!headerRow) return null;

    const items = await this.findItemsByRequestId(id);
    const request = ImportRequest.fromPersistence(headerRow);
    request.items = items;
    return { request, items };
  }

  async findItemsByRequestId(importRequestId) {
    const result = await query(
      `SELECT iri.id, iri.import_request_id, iri.product_id, iri.product_code,
              iri.product_name,
              CASE WHEN iri.unit IS NULL OR iri.unit LIKE N'%?%'
                   THEN COALESCE(NULLIF(u.unit_name, N''), iri.unit)
                   ELSE iri.unit END AS unit,
              iri.quantity
       FROM import_request_items iri
       LEFT JOIN products p ON p.id = iri.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE iri.import_request_id = @importRequestId
       ORDER BY iri.id ASC`,
      { importRequestId }
    );
    return result.recordset.map((r) => ImportRequestItem.fromPersistence(r));
  }

  /**
   * Sinh ma phieu: IRB-{branchId}-{YYYYMMDD}-{sequence:4}.
   * Sequence dem so phieu cung branch cung ngay.
   */
  /**
   * Kiem tra 1 nha cung cap da co phieu nhap nao dung so hoa don nay chua
   * (tranh nhap trung 1 hoa don 2 lan). Trung theo (supplier_id, supplier_invoice_no),
   * khong phan biet chi nhanh vi nha cung cap la du lieu dung chung toan he thong.
   * @returns {Promise<boolean>}
   */
  async existsBySupplierInvoice(supplierId, supplierInvoiceNo) {
    const result = await query(
      `SELECT TOP 1 id FROM import_requests
       WHERE supplier_id = @supplierId AND supplier_invoice_no = @supplierInvoiceNo`,
      { supplierId: Number(supplierId), supplierInvoiceNo }
    );
    return result.recordset.length > 0;
  }

  async getNextRequestCode(branchId, date, tx = null) {
    const d = date instanceof Date ? date : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const prefix = `IRB-${branchId}-${dateKey}-`;

    let result;
    if (tx) {
      result = await tx.request()
        .input('pattern', sql.VarChar(40), `${prefix}%`)
        .query(`
          SELECT TOP 1 request_code
          FROM import_requests WITH (UPDLOCK, HOLDLOCK)
          WHERE request_code LIKE @pattern
          ORDER BY request_code DESC
        `);
    } else {
      result = await query(
        `SELECT TOP 1 request_code
         FROM import_requests
         WHERE request_code LIKE @pattern
         ORDER BY request_code DESC`,
        { pattern: `${prefix}%` }
      );
    }
    let sequence = 1;
    if (result.recordset[0]) {
      const lastCode = result.recordset[0].request_code;
      const lastSeq = parseInt(lastCode.substring(prefix.length), 10);
      if (Number.isFinite(lastSeq)) sequence = lastSeq + 1;
    }
    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  async create(tx, requestData, items) {
    const insertReq = await tx.request()
      .input('request_code', sql.VarChar(30), requestData.request_code)
      .input('branch_id', sql.BigInt, requestData.branch_id)
      .input('supplier_id', sql.BigInt, requestData.supplier_id ?? null)
      .input('supplier_invoice_no', sql.VarChar(50), requestData.supplier_invoice_no ?? null)
      .input('requested_by', sql.BigInt, requestData.requested_by)
      .input('import_date', sql.Date, requestData.import_date ?? new Date())
      .input('notes', sql.NVarChar(500), requestData.notes ?? null)
      .query(`
        INSERT INTO import_requests (
          request_code, branch_id, supplier_id, supplier_invoice_no,
          requested_by, import_date, status, notes, created_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @request_code, @branch_id, @supplier_id, @supplier_invoice_no,
          @requested_by, @import_date, 'pending', @notes, GETDATE()
        )
      `);
    const newId = insertReq.recordset[0].id;

    for (const item of items) {
      await tx.request()
        .input('import_request_id', sql.BigInt, newId)
        .input('product_id', sql.BigInt, item.product_id ?? null)
        .input('product_code', sql.VarChar(30), item.product_code)
        .input('product_name', sql.NVarChar(200), item.product_name)
        .input('unit', sql.NVarChar(20), item.unit ?? null)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          INSERT INTO import_request_items (
            import_request_id, product_id, product_code, product_name, unit, quantity
          )
          VALUES (
            @import_request_id, @product_id, @product_code, @product_name, @unit, @quantity
          )
        `);
    }

    return newId;
  }

  /**
   * Duyet phieu: (1) lock + set status=approved, (2) cong stock, (3) ghi log.
   * Service phai goi trong runInTransaction().
   * Tra ve request + items (de service sinh transaction_code rieng).
   */
  async approve(tx, id, approvedBy, importDate, { branchId } = {}) {
    const branchScopeSql = branchId == null ? '' : ' AND branch_id = @branch_id';
    const updateResult = await tx.request()
      .input('id', sql.BigInt, id)
      .input('approved_by', sql.BigInt, approvedBy)
      .input('import_date', sql.Date, importDate ?? new Date())
      .input('branch_id', sql.BigInt, branchId == null ? null : Number(branchId))
      .query(`
        UPDATE import_requests
        SET status = 'approved',
            approved_by = @approved_by,
            import_date = @import_date
        WHERE id = @id AND status = 'pending'${branchScopeSql}
      `);
    if (updateResult.rowsAffected[0] !== 1) {
      return null;
    }

    const headerRow = (await tx.request()
      .input('id', sql.BigInt, id)
      .query(`SELECT * FROM import_requests WHERE id = @id`)).recordset[0];

    const itemsResult = await tx.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT id, import_request_id, product_id, product_code, product_name, unit, quantity
        FROM import_request_items
        WHERE import_request_id = @id
      `);
    const items = itemsResult.recordset.map((r) => ImportRequestItem.fromPersistence(r));

    const requestBranchId = headerRow.branch_id;
    const dateKey = (importDate ?? new Date()).toISOString().slice(0, 10).replace(/-/g, '');
    const txPrefix = `IT-${requestBranchId}-${dateKey}-`;

    // Lay sequence tiep theo de sinh transaction_code.
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

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!Number.isFinite(Number(item.productId)) || Number(item.productId) <= 0) {
        throw new ApiError(400, `Phieu nhap ${headerRow.request_code} co dong khong hop le`);
      }

      const stockUpdate = await tx.request()
        .input('product_id', sql.BigInt, item.productId)
        .input('branch_id', sql.BigInt, requestBranchId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          UPDATE products
          SET stock_quantity = stock_quantity + @quantity
          WHERE id = @product_id AND branch_id = @branch_id
        `);
      if (stockUpdate.rowsAffected[0] !== 1) {
        throw new ApiError(409, `Khong tim thay phu tung ${item.productCode} trong chi nhanh ${requestBranchId}`);
      }

      const txCode = `${txPrefix}${String(nextSeq + i).padStart(4, '0')}`;
      await tx.request()
        .input('transaction_code', sql.VarChar(30), txCode)
        .input('branch_id', sql.BigInt, requestBranchId)
        .input('product_id', sql.BigInt, item.productId)
        .input('quantity', sql.Int, item.quantity)
        .input('import_request_id', sql.BigInt, id)
        .input('performed_by', sql.BigInt, approvedBy)
        .input('request_code', sql.VarChar(30), headerRow.request_code)
        .query(`
          INSERT INTO inventory_transactions (
            transaction_code, transaction_type, branch_id, product_id,
            quantity, import_request_id, performed_by,
            transaction_date, status, notes
          )
          VALUES (
            @transaction_code, 'import', @branch_id, @product_id,
            @quantity, @import_request_id, @performed_by,
            GETDATE(), 'completed',
            'Nhap kho theo phieu ' + @request_code
          )
        `);
    }

    return {
      request: ImportRequest.fromPersistence(headerRow),
      items,
    };
  }

  async reject(tx, id, _rejectedBy, rejectReason, { branchId } = {}) {
    const branchScopeSql = branchId == null ? '' : ' AND branch_id = @branch_id';
    const result = await tx.request()
      .input('id', sql.BigInt, id)
      .input('branch_id', sql.BigInt, branchId == null ? null : Number(branchId))
      .input('reject_reason', sql.NVarChar(500), rejectReason)
      .query(`
        UPDATE import_requests
        SET status = 'rejected',
            reject_reason = @reject_reason
        WHERE id = @id AND status = 'pending'${branchScopeSql}
      `);
    return result.rowsAffected[0] === 1;
  }

  /**
   * Danh dau 1 phieu nhap la "da xem" boi Manager (dung cho thong bao dom).
   */
  async markSeenByManager(id) {
    await query(
      `UPDATE import_requests SET seen_by_manager_at = GETDATE() WHERE id = @id AND seen_by_manager_at IS NULL`,
      { id }
    );
  }

  /**
   * Dem so phieu nhap chua duoc Manager xem (dung cho badge do tren Navbar).
   */
  async countNewForManager(branchId) {
    const result = await query(
      `SELECT COUNT(*) AS total FROM import_requests WHERE branch_id = @branchId AND seen_by_manager_at IS NULL`,
      { branchId }
    );
    return result.recordset[0].total;
  }
}

module.exports = ImportRequestRepositoryImpl;
