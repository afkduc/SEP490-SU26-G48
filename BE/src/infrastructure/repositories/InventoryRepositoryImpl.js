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
      return product;
    });
  }
}

module.exports = InventoryRepositoryImpl;
