const ProductRepository = require('../../domain/repositories/ProductRepository');
const Product = require('../../domain/entities/Product');
const { query } = require('../database/sqlServer');

class ProductRepositoryImpl extends ProductRepository {
  async findAll({ branchId, status, search, category, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT p.*, s.supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
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
      params.search = `%${search}%`;
      sql += ` AND (p.product_code LIKE @search OR p.product_name LIKE @search)`;
    }
    if (category) {
      params.category = category;
      sql += ` AND p.category = @category`;
    }

    sql += ` ORDER BY p.id DESC`;
    sql += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    params.offset = offset;
    params.limit = limit;

    const result = await query(sql, params);
    return result.recordset.map((r) => Product.fromPersistence(r));
  }

  async findById(id) {
    const sql = `
      SELECT p.*, s.supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = @id
    `;
    const result = await query(sql, { id });
    return Product.fromPersistence(result.recordset[0]);
  }

  async findByCode(code) {
    const sql = `SELECT * FROM products WHERE product_code = @code`;
    const result = await query(sql, { code });
    return Product.fromPersistence(result.recordset[0]);
  }

  async create(data) {
    const sql = `
      INSERT INTO products (
        product_code, product_name, category, brand_name, unit,
        unit_price, stock_quantity, min_stock, supplier_id,
        location, branch_id, status
      )
      VALUES (
        @productCode, @productName, @category, @brandName, @unit,
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
      unit: data.unit || 'Cai',
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
    if (data.unit !== undefined) {
      params.unit = data.unit;
      fields.push('unit = @unit');
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
    const before = await this.findById(id);
    if (!before) return null;
    await query(`DELETE FROM products WHERE id = @id`, { id });
    return before;
  }

  async count({ branchId, status, search, category } = {}) {
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
      params.search = `%${search}%`;
      sql += ` AND (product_code LIKE @search OR product_name LIKE @search)`;
    }
    if (category) {
      params.category = category;
      sql += ` AND category = @category`;
    }

    const result = await query(sql, params);
    return result.recordset[0].total;
  }
}

module.exports = ProductRepositoryImpl;
