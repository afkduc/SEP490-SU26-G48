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
   * Thong ke phu tung duoc su dung nhieu nhat, ket hop:
   *   - inventory_transactions (transaction_type='export', status='completed')
   *     -> so lieu XUAT KHO THUC TE.
   *   - service_order_items (lhsc='PT')
   *     -> NHU CAU phu tung tren phieu quyet toan (co the chua kip xuat kho).
   * 2 nguon duoc gop lai theo product_id (FULL OUTER JOIN) de FE co the so
   * sanh "nhu cau" vs "thuc xuat" cho tung phu tung/hang.
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
        SELECT it.product_id,
               SUM(it.quantity) AS export_quantity,
               COUNT(*) AS export_count
        FROM   inventory_transactions it
        WHERE  it.branch_id = @branchId
          AND  it.transaction_type = 'export'
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
        FROM   service_order_items soi
        JOIN   service_orders so ON so.id = soi.service_order_id
        WHERE  so.branch_id = @branchId
          AND  soi.lhsc = 'PT'
          AND  soi.product_id IS NOT NULL
          AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
          AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
        GROUP BY soi.product_id
      ),
      combined AS (
        SELECT
          COALESCE(e.product_id, d.product_id) AS product_id,
          ISNULL(e.export_quantity, 0) AS export_quantity,
          ISNULL(e.export_count, 0) AS export_count,
          ISNULL(d.demand_quantity, 0) AS demand_quantity,
          ISNULL(d.demand_count, 0) AS demand_count
        FROM export_stats e
        FULL OUTER JOIN demand_stats d ON e.product_id = d.product_id
      )
    `;

    const sqlText = `
      ${cte}
      SELECT TOP (@limit)
        c.product_id,
        p.product_code, p.product_name, p.category, p.brand_name,
        u.unit_name, p.stock_quantity,
        c.export_quantity, c.export_count, c.demand_quantity, c.demand_count,
        (c.export_quantity + c.demand_quantity) AS total_quantity
      FROM combined c
      JOIN products p ON p.id = c.product_id
      LEFT JOIN units u ON u.id = p.unit_id
      ORDER BY total_quantity DESC, c.export_quantity DESC, p.product_name ASC;

      ${cte}
      SELECT
        ISNULL(p.brand_name, N'Không xác định') AS brand_name,
        SUM(c.export_quantity) AS export_quantity,
        SUM(c.export_count) AS export_count,
        SUM(c.demand_quantity) AS demand_quantity,
        SUM(c.demand_count) AS demand_count,
        SUM(c.export_quantity + c.demand_quantity) AS total_quantity
      FROM combined c
      JOIN products p ON p.id = c.product_id
      GROUP BY p.brand_name
      ORDER BY total_quantity DESC;

      ${cte}
      SELECT
        COUNT(*) AS distinct_parts,
        ISNULL(SUM(c.export_quantity), 0) AS total_export_quantity,
        ISNULL(SUM(c.export_count), 0) AS total_export_count,
        ISNULL(SUM(c.demand_quantity), 0) AS total_demand_quantity,
        ISNULL(SUM(c.demand_count), 0) AS total_demand_count
      FROM combined c;
    `;

    const result = await query(sqlText, params);
    const [topPartsRecordset, topBrandsRecordset, summaryRecordset] = result.recordsets;

    const topParts = topPartsRecordset.map((r) => ({
      productId: r.product_id,
      productCode: r.product_code,
      productName: r.product_name,
      category: r.category,
      brandName: r.brand_name,
      unit: r.unit_name || 'Cai',
      currentStock: Number(r.stock_quantity) || 0,
      exportQuantity: Number(r.export_quantity) || 0,
      exportCount: Number(r.export_count) || 0,
      demandQuantity: Number(r.demand_quantity) || 0,
      demandCount: Number(r.demand_count) || 0,
      totalQuantity: Number(r.total_quantity) || 0,
    }));

    const totalQuantityAll = topBrandsRecordset.reduce((sum, r) => sum + (Number(r.total_quantity) || 0), 0);
    const topBrands = topBrandsRecordset.map((r) => {
      const total = Number(r.total_quantity) || 0;
      return {
        brandName: r.brand_name,
        exportQuantity: Number(r.export_quantity) || 0,
        exportCount: Number(r.export_count) || 0,
        demandQuantity: Number(r.demand_quantity) || 0,
        demandCount: Number(r.demand_count) || 0,
        totalQuantity: total,
        percentage: totalQuantityAll > 0 ? Math.round((total / totalQuantityAll) * 1000) / 10 : 0,
      };
    });

    const summaryRow = summaryRecordset[0] || {};
    const summary = {
      distinctParts: Number(summaryRow.distinct_parts) || 0,
      totalExportQuantity: Number(summaryRow.total_export_quantity) || 0,
      totalExportCount: Number(summaryRow.total_export_count) || 0,
      totalDemandQuantity: Number(summaryRow.total_demand_quantity) || 0,
      totalDemandCount: Number(summaryRow.total_demand_count) || 0,
    };

    return { topParts, topBrands, summary };
  }
}

module.exports = InventoryRepositoryImpl;
