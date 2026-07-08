const InventoryRepository = require('../../domain/repositories/InventoryRepository');
const Product = require('../../domain/entities/Product');
const { query } = require('../database/sqlServer');

class InventoryRepositoryImpl extends InventoryRepository {
  async getStockByBranch(branchId, {
    search,
    category,
    lowStockOnly = false,
    page = 1,
    limit = 20,
  } = {}) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT p.*, s.supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.branch_id = @branchId
    `;
    const params = { branchId, offset, limit };

    if (search) {
      params.search = `%${search}%`;
      sql += ` AND (p.product_code LIKE @search OR p.product_name LIKE @search)`;
    }
    if (category) {
      params.category = category;
      sql += ` AND p.category = @category`;
    }
    if (lowStockOnly) {
      sql += ` AND p.stock_quantity <= p.min_stock`;
    }

    sql += ` ORDER BY p.product_name ASC`;
    sql += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const result = await query(sql, params);
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      return product;
    });
  }

  async countStockByBranch(branchId, { search, category, lowStockOnly = false } = {}) {
    let sql = `SELECT COUNT(*) AS total FROM products WHERE branch_id = @branchId`;
    const params = { branchId };

    if (search) {
      params.search = `%${search}%`;
      sql += ` AND (product_code LIKE @search OR product_name LIKE @search)`;
    }
    if (category) {
      params.category = category;
      sql += ` AND category = @category`;
    }
    if (lowStockOnly) {
      sql += ` AND stock_quantity <= min_stock`;
    }

    const result = await query(sql, params);
    return result.recordset[0].total;
  }

  async getLowStock(branchId) {
    const sql = `
      SELECT p.*, s.supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.branch_id = @branchId
        AND p.stock_quantity <= p.min_stock
        AND p.status = 'active'
      ORDER BY p.stock_quantity ASC
    `;
    const result = await query(sql, { branchId });
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      return product;
    });
  }

  async getStockByProduct(productId, branchId) {
    const sql = `
      SELECT p.*, s.supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = @productId AND p.branch_id = @branchId
    `;
    const result = await query(sql, { productId, branchId });
    if (!result.recordset[0]) return null;
    const product = Product.fromPersistence(result.recordset[0]);
    product.supplierName = result.recordset[0].supplier_name;
    return product;
  }

  async updateStock(productId, branchId, quantity) {
    const sql = `
      UPDATE products
      SET stock_quantity = stock_quantity + @quantity
      WHERE id = @productId AND branch_id = @branchId;
      SELECT * FROM products WHERE id = @productId;
    `;
    const result = await query(sql, { productId, branchId, quantity });
    return Product.fromPersistence(result.recordset[0]);
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
}

module.exports = InventoryRepositoryImpl;
