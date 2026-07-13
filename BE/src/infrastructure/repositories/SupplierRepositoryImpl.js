const SupplierRepository = require('../../domain/repositories/SupplierRepository');
const Supplier = require('../../domain/entities/Supplier');
const { query } = require('../database/sqlServer');

class SupplierRepositoryImpl extends SupplierRepository {
  async findAll({ search, status } = {}) {
    const conditions = ['1=1'];
    const params = {};
    let p = 1;

    if (search) {
      conditions.push(`(
        supplier_code LIKE @p${p}
        OR supplier_name LIKE @p${p}
        OR contact_name LIKE @p${p}
        OR phone LIKE @p${p}
      )`);
      params[`p${p}`] = `%${search}%`;
      p++;
    }

    if (status) {
      conditions.push(`status = @p${p}`);
      params[`p${p}`] = status;
      p++;
    }

    const sql = `
      SELECT id, supplier_code, supplier_name, contact_name,
             phone, email, address, tax_code, status
      FROM   suppliers
      WHERE  ${conditions.join(' AND ')}
      ORDER  BY supplier_name ASC
    `;
    const result = await query(sql, params);
    return result.recordset.map((r) => Supplier.fromPersistence(r));
  }

  async findById(id) {
    const result = await query(
      `SELECT id, supplier_code, supplier_name, contact_name,
              phone, email, address, tax_code, status
       FROM   suppliers
       WHERE  id = @id`,
      { id }
    );
    const row = result.recordset[0];
    return row ? Supplier.fromPersistence(row) : null;
  }
}

module.exports = SupplierRepositoryImpl;