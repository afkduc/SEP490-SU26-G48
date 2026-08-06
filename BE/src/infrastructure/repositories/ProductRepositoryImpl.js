const ProductRepository = require('../../domain/repositories/ProductRepository');
const Product = require('../../domain/entities/Product');
const { query } = require('../database/sqlServer');
const { normalizeVietnamese } = require('../../utils/vietnamese');

class ProductRepositoryImpl extends ProductRepository {
  async findAll({ branchId, status, search, category, lowStockOnly, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT p.*, s.supplier_name, u.unit_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN units u ON p.unit_id = u.id
      WHERE 1=1
    `;
    const params = {};

    if (branchId) {
      params.branchId = branchId;
      sql += ` AND p.branch_id = @branchId`;
    }
    if (status) {
      params.status = status;
      sql += ` AND p.status = @status`;
    }
    if (search) {
      const normalizedSearch = normalizeVietnamese(search);
      params.search = normalizedSearch;
      sql += ` AND (
        dbo.RemoveVietnameseAccents(p.product_code) LIKE '%' + @search + '%'
        OR dbo.RemoveVietnameseAccents(p.product_name) LIKE '%' + @search + '%'
      )`;
    }
    if (category) {
      params.category = category;
      sql += ` AND p.category COLLATE Vietnamese_CI_AI = @category`;
    }
    if (lowStockOnly) {
      sql += ` AND p.stock_quantity <= p.min_stock AND p.min_stock > 0`;
    }

    sql += ` ORDER BY p.id DESC`;
    sql += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    params.offset = offset;
    params.limit = limit;

    const result = await query(sql, params);
    return result.recordset.map((r) => {
      const product = Product.fromPersistence(r);
      product.supplierName = r.supplier_name;
      product.unit = r.unit_name || 'Cai';
      return product;
    });
  }

  async findById(id) {
    const sql = `
      SELECT p.*, s.supplier_name, u.unit_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN units u ON p.unit_id = u.id
      WHERE p.id = @id
    `;
    const result = await query(sql, { id });
    if (!result.recordset[0]) return null;
    const product = Product.fromPersistence(result.recordset[0]);
    product.supplierName = result.recordset[0].supplier_name;
    product.unit = result.recordset[0].unit_name || 'Cai';
    return product;
  }

  async findByCode(code, branchId) {
    const where = branchId ? 'product_code = @code AND branch_id = @branchId' : 'product_code = @code';
    const params = branchId ? { code, branchId } : { code };
    const result = await query(
      `SELECT p.*, s.supplier_name, u.unit_name
       FROM   products p
       LEFT   JOIN suppliers s ON p.supplier_id = s.id
       LEFT   JOIN units u ON p.unit_id = u.id
       WHERE  ${where}`,
      params
    );
    const row = result.recordset[0];
    if (!row) return null;
    const product = Product.fromPersistence(row);
    product.supplierName = row.supplier_name;
    product.unit = row.unit_name || 'Cai';
    return product;
  }

  async create(data) {
    const sql = `
      INSERT INTO products (
        product_code, product_name, category, brand_name, unit_id,
        unit_price, stock_quantity, min_stock, supplier_id,
        location, branch_id, status
      )
      VALUES (
        @productCode, @productName, @category, @brandName, @unitId,
        @unitPrice, @stockQuantity, @minStock, @supplierId,
        @location, @branchId, @status
      );
      SELECT SCOPE_IDENTITY() AS id;
    `;
    const params = {
      productCode: data.productCode,
      productName: data.productName,
      category: data.category || null,
      brandName: data.brandName || null,
      unitId: data.unitId || 1,
      unitPrice: data.unitPrice || null,
      stockQuantity: data.stockQuantity || 0,
      minStock: data.minStock || 0,
      supplierId: data.supplierId || null,
      location: data.location || null,
      branchId: data.branchId || null,
      status: data.status || 'active',
    };
    const result = await query(sql, params);
    const newId = result.recordset[0].id;
    return this.findById(newId);
  }

  async update(id, data) {
    const fields = [];
    const params = { id };

    if (data.productName !== undefined) {
      params.productName = data.productName;
      fields.push('product_name = @productName');
    }
    if (data.category !== undefined) {
      params.category = data.category;
      fields.push('category = @category');
    }
    if (data.brandName !== undefined) {
      params.brandName = data.brandName;
      fields.push('brand_name = @brandName');
    }
    if (data.unitId !== undefined) {
      params.unitId = data.unitId;
      fields.push('unit_id = @unitId');
    }
    if (data.unitPrice !== undefined) {
      params.unitPrice = data.unitPrice;
      fields.push('unit_price = @unitPrice');
    }
    if (data.minStock !== undefined) {
      params.minStock = data.minStock;
      fields.push('min_stock = @minStock');
    }
    if (data.supplierId !== undefined) {
      params.supplierId = data.supplierId;
      fields.push('supplier_id = @supplierId');
    }
    if (data.location !== undefined) {
      params.location = data.location;
      fields.push('location = @location');
    }
    if (data.status !== undefined) {
      params.status = data.status;
      fields.push('status = @status');
    }

    if (fields.length === 0) return this.findById(id);

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = @id`;
    await query(sql, params);
    return this.findById(id);
  }

  async delete(id) {
    // Soft-disable: không hard DELETE (đồng bộ nghiệp vụ Disable/Ngừng).
    const before = await this.findById(id);
    if (!before) return null;
    if (before.status === 'inactive') return before;
    await query(`UPDATE products SET status = N'inactive' WHERE id = @id`, { id });
    return this.findById(id);
  }

  async reactivate(id) {
    const before = await this.findById(id);
    if (!before) return null;
    if (before.status === 'active') return before;
    await query(`UPDATE products SET status = N'active' WHERE id = @id`, { id });
    return this.findById(id);
  }

  async count({ branchId, status, search, category, lowStockOnly } = {}) {
    let sql = `SELECT COUNT(*) AS total FROM products WHERE 1=1`;
    const params = {};

    if (branchId) {
      params.branchId = branchId;
      sql += ` AND branch_id = @branchId`;
    }
    if (status) {
      params.status = status;
      sql += ` AND status = @status`;
    }
    if (search) {
      const normalizedSearch = normalizeVietnamese(search);
      params.search = normalizedSearch;
      sql += ` AND (
        dbo.RemoveVietnameseAccents(product_code) LIKE '%' + @search + '%'
        OR dbo.RemoveVietnameseAccents(product_name) LIKE '%' + @search + '%'
      )`;
    }
    if (category) {
      params.category = category;
      sql += ` AND category COLLATE Vietnamese_CI_AI = @category`;
    }
    if (lowStockOnly) {
      sql += ` AND stock_quantity <= min_stock AND min_stock > 0`;
    }

    const result = await query(sql, params);
    return result.recordset[0].total;
  }

async getDistinctCategories() {
    const sql = `
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category ASC
    `;
    const result = await query(sql, []);
    return result.recordset.map((r) => r.category);
  }

  async listUnits() {
    const result = await query(`SELECT id, unit_name FROM units ORDER BY unit_name`);
    return result.recordset.map((r) => ({ id: r.id, name: r.unit_name }));
  }
}

module.exports = ProductRepositoryImpl;
