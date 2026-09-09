const InventoryRepository = require('../../domain/repositories/InventoryRepository');
const Product = require('../../domain/entities/Product');
const sql = require('mssql');
const { query } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

/**
 * Build WHERE clause cho cac filter (search/category/lowStockOnly) dung chung
 * giua cac ham getStockByBranch / countStockByBranch / getLowStock.
 */
function buildProductFilters(branchId, { search, category, lowStockOnly = false } = {}, { includeJoin = false } = {}) {
  const where = ['p.branch_id = @branchId'];
  const params = { branchId };
  if (search) {
    params.search = `%${search}%`;
    where.push('(p.product_code LIKE @search OR p.product_name LIKE @search)');
  }
  if (category) {
    params.category = category;
    where.push('p.category = @category');
  }
  if (lowStockOnly) {
    where.push('p.stock_quantity <= p.min_stock');
  }
  const join = includeJoin ? 'LEFT JOIN suppliers s ON p.supplier_id = s.id' : '';
  return { join, where: where.join(' AND '), params };
}

class InventoryRepositoryImpl extends InventoryRepository {
  async getStockByBranch(branchId, {
    search,
    category,
    lowStockOnly = false,
    page = 1,
    limit = 20,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const { join, where, params } = buildProductFilters(
      branchId,
      { search, category, lowStockOnly },
      { includeJoin: true },
    );
    const sql = `
      SELECT p.*, s.supplier_name, u.unit_name
      FROM products p
      ${join}
      LEFT JOIN units u ON p.unit_id = u.id
      WHERE ${where}
      ORDER BY p.product_name ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const result = await query(sql, { ...params, offset, limit: safeLimit });
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      product.unit = r.unit_name || 'Cai';
      return product;
    });
  }

  async countStockByBranch(branchId, { search, category, lowStockOnly = false } = {}) {
    const { where, params } = buildProductFilters(branchId, { search, category, lowStockOnly });
    const sql = `SELECT COUNT(*) AS total FROM products p WHERE ${where}`;
    const result = await query(sql, params);
    return result.recordset[0].total;
  }

  async getLowStock(branchId) {
    const { join, where, params } = buildProductFilters(
      branchId,
      { lowStockOnly: true },
      { includeJoin: true },
    );
    const sql = `
      SELECT p.*, s.supplier_name, u.unit_name
      FROM products p
      ${join}
      LEFT JOIN units u ON p.unit_id = u.id
      WHERE ${where} AND p.status = 'active'
      ORDER BY p.stock_quantity ASC
    `;
    const result = await query(sql, params);
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      product.unit = r.unit_name || 'Cai';
      return product;
    });
  }

  async getStockByProduct(productId, branchId) {
    const sql = `
      SELECT p.*, s.supplier_name, u.unit_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN units u ON p.unit_id = u.id
      WHERE p.id = @productId AND p.branch_id = @branchId
    `;
    const result = await query(sql, { productId, branchId });
    if (!result.recordset[0]) return null;
    const product = Product.fromPersistence(result.recordset[0]);
    product.supplierName = result.recordset[0].supplier_name;
    product.unit = result.recordset[0].unit_name || 'Cai';
    return product;
  }

  /**
   * Atomically adjust stock in a transaction.
   * - Guard: chỉ UPDATE khi stock_quantity + @quantity >= 0 (tránh âm).
   * - Trả về record đã update kèm supplier_name (LEFT JOIN).
   * - Transaction đảm bảo consistency nếu sau này có insert inventory_transactions.
   */
  async adjustStock(productId, branchId, quantity, _options = {}) {
    return runInTransaction(async (tx) => {
      const updateSql = `
        UPDATE products
        SET stock_quantity = stock_quantity + @quantity
        WHERE id = @productId
          AND branch_id = @branchId
          AND stock_quantity + @quantity >= 0
      `;
      const updateResult = await tx.request()
        .input('productId', sql.BigInt, productId)
        .input('branchId', sql.BigInt, branchId)
        .input('quantity', sql.Int, quantity)
        .query(updateSql);

      if (updateResult.rowsAffected[0] === 0) {
        return null;
      }

      const selectResult = await tx.request()
        .input('productId', sql.BigInt, productId)
        .input('branchId', sql.BigInt, branchId)
        .query(`
          SELECT p.*, s.supplier_name, u.unit_name
          FROM products p
          LEFT JOIN suppliers s ON p.supplier_id = s.id
          LEFT JOIN units u ON p.unit_id = u.id
          WHERE p.id = @productId AND p.branch_id = @branchId
        `);

      const row = selectResult.recordset[0];
      if (!row) return null;
      const product = Product.fromPersistence(row);
      product.supplierName = row.supplier_name;
      product.unit = row.unit_name || 'Cai';
      return product;
    });
  }

  async updateStock(productId, branchId, quantity) {
    return this.adjustStock(productId, branchId, quantity);
  }

  async getStockSummaryByCategory(branchId) {
    const sql = `
      SELECT
        p.category,
        COUNT(p.id) AS productCount,
        SUM(p.stock_quantity) AS totalQuantity,
        SUM(p.stock_quantity * ISNULL(p.unit_price, 0)) AS totalValue
      FROM products p
      WHERE p.branch_id = @branchId AND p.status = 'active'
      GROUP BY p.category
      ORDER BY totalValue DESC
    `;
    const result = await query(sql, { branchId });
    return result.recordset.map((r) => ({
      category: r.category || 'Khong xac dinh',
      productCount: r.productCount,
      totalQuantity: r.totalQuantity,
      totalValue: Number(r.totalValue) || 0,
    }));
  }

  async findAllActiveProducts(branchId) {
    const result = await query(
      `SELECT p.*, s.supplier_name, u.unit_name
       FROM   products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN units u ON u.id = p.unit_id
       WHERE  p.branch_id = @branchId AND p.status = 'active'
       ORDER  BY p.product_name`,
      { branchId }
    );
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      product.unit = r.unit_name || 'Cai';
      return product;
    });
  }

  /**
   * Thong ke phu tung duoc su dung nhieu nhat. Chi tinh phu tung DA XUAT
   * KHO THUC TE (co giao dich trong inventory_transactions, transaction_type=
   * 'export', status='completed') - phu tung chi co nhu cau tren phieu
   * quyet toan (repair_order_items, lhsc='PT') nhung chua xuat kho se KHONG
   * xuat hien trong danh sach nay. demand_quantity/demand_count van duoc
   * gop them cho cac phu tung da xuat, de FE so sanh "nhu cau" vs "thuc xuat".
   * summary.totalExportCount/totalImportCount la SO PHIEU phan biet (COUNT
   * DISTINCT export_request_id/import_request_id), khong phai so dong giao
   * dich - 1 phieu co nhieu dong (nhieu phu tung) van tinh la 1 lan.
   */
  async getTopUsedPartsStats(branchId, { fromDate, toDate, limit = 10 } = {}) {
    const params = {
      branchId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      limit: Math.min(50, Math.max(1, Number(limit) || 10)),
    };

    const cte = `
      WITH export_stats AS (
        -- SL xuat RONG: tru di phan da tra lai kho ('return'), neu khong phu
        -- tung xuat roi tra het van bi tinh la "dung nhieu".
        SELECT it.product_id,
               SUM(CASE WHEN it.transaction_type = 'export' THEN it.quantity ELSE -it.quantity END) AS export_quantity,
               SUM(CASE WHEN it.transaction_type = 'export' THEN 1 ELSE 0 END) AS export_count
        FROM   inventory_transactions it
        WHERE  it.branch_id = @branchId
          AND  it.transaction_type IN ('export', 'return')
          AND  it.status = 'completed'
          AND  it.product_id IS NOT NULL
          AND  (@fromDate IS NULL OR it.transaction_date >= @fromDate)
          AND  (@toDate IS NULL OR it.transaction_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
        GROUP BY it.product_id
      ),
      demand_stats AS (
        SELECT soi.product_id,
               SUM(soi.quantity) AS demand_quantity,
               COUNT(*) AS demand_count
        FROM   repair_order_items soi
        JOIN   repair_orders so ON so.id = soi.repair_order_id
        WHERE  so.branch_id = @branchId
          AND  soi.lhsc = 'PT'
          AND  soi.product_id IS NOT NULL
          AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
          AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
        GROUP BY soi.product_id
      ),
      combined AS (
        -- Chi lay phu tung DA XUAT KHO thuc te (co mat trong export_stats).
        -- Nhu cau tren phieu quyet toan (demand_stats) chi la thong tin bo
        -- sung, khong tu minh dua phu tung vao danh sach neu chua xuat kho.
        SELECT
          e.product_id AS product_id,
          e.export_quantity AS export_quantity,
          e.export_count AS export_count,
          ISNULL(d.demand_quantity, 0) AS demand_quantity,
          ISNULL(d.demand_count, 0) AS demand_count
        FROM export_stats e
        LEFT JOIN demand_stats d ON e.product_id = d.product_id
      ),
      import_stats AS (
        -- import_count = so PHIEU nhap kho phan biet (khong phai so dong
        -- giao dich, vi 1 phieu co the co nhieu dong ung voi nhieu phu tung).
        SELECT
          SUM(it.quantity) AS import_quantity,
          COUNT(DISTINCT it.import_request_id) AS import_count
        FROM   inventory_transactions it
        WHERE  it.branch_id = @branchId
          AND  it.transaction_type = 'import'
          AND  it.status = 'completed'
          AND  (@fromDate IS NULL OR it.transaction_date >= @fromDate)
          AND  (@toDate IS NULL OR it.transaction_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
      ),
      export_request_stats AS (
        -- export_count tong hop = so PHIEU xuat kho phan biet, cung logic
        -- voi import_count o tren (khong dung SUM(c.export_count) vi do la
        -- so dong giao dich theo tung phu tung, se dem trung phieu).
        SELECT
          COUNT(DISTINCT it.export_request_id) AS export_request_count
        FROM   inventory_transactions it
        WHERE  it.branch_id = @branchId
          AND  it.transaction_type = 'export'
          AND  it.status = 'completed'
          AND  (@fromDate IS NULL OR it.transaction_date >= @fromDate)
          AND  (@toDate IS NULL OR it.transaction_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
      )
    `;

    const sqlText = `
      ${cte}
      SELECT TOP (@limit)
        c.product_id,
        p.product_code, p.product_name, p.category,
        u.unit_name, p.stock_quantity,
        c.export_quantity, c.export_count, c.demand_quantity, c.demand_count,
        (c.export_quantity + c.demand_quantity) AS total_quantity
      FROM combined c
      JOIN products p ON p.id = c.product_id
      LEFT JOIN units u ON u.id = p.unit_id
      ORDER BY total_quantity DESC, c.export_quantity DESC, p.product_name ASC;

      ${cte}
      SELECT
        COUNT(*) AS distinct_parts,
        ISNULL(SUM(c.export_quantity), 0) AS total_export_quantity,
        ISNULL((SELECT export_request_count FROM export_request_stats), 0) AS total_export_count,
        ISNULL((SELECT import_quantity FROM import_stats), 0) AS total_import_quantity,
        ISNULL((SELECT import_count FROM import_stats), 0) AS total_import_count
      FROM combined c;
    `;

    const result = await query(sqlText, params);
    const [topPartsRecordset, summaryRecordset] = result.recordsets;

    const topParts = topPartsRecordset.map((r) => ({
      productId: r.product_id,
      productCode: r.product_code,
      productName: r.product_name,
      category: r.category,
      unit: r.unit_name || 'Cai',
      currentStock: Number(r.stock_quantity) || 0,
      exportQuantity: Number(r.export_quantity) || 0,
      exportCount: Number(r.export_count) || 0,
      demandQuantity: Number(r.demand_quantity) || 0,
      demandCount: Number(r.demand_count) || 0,
      totalQuantity: Number(r.total_quantity) || 0,
    }));

    const summaryRow = summaryRecordset[0] || {};
    const summary = {
      distinctParts: Number(summaryRow.distinct_parts) || 0,
      totalExportQuantity: Number(summaryRow.total_export_quantity) || 0,
      totalExportCount: Number(summaryRow.total_export_count) || 0,
      totalImportQuantity: Number(summaryRow.total_import_quantity) || 0,
      totalImportCount: Number(summaryRow.total_import_count) || 0,
    };

    return { topParts, summary };
  }
}

module.exports = InventoryRepositoryImpl;
