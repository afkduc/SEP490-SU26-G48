const CatalogSearchRepository = require('../../domain/repositories/CatalogSearchRepository');
const { query } = require('../database/sqlServer');

// Catalog (services + service_packages) rat nho (vai chuc dong), nen lay het
// roi loc/khong-dau-hoa o tang Service thay vi loc bang SQL LIKE - vi
// COLLATE ..._CI_AI cua SQL Server khong gop ư/ơ ve u/o hay đ ve d.
class CatalogSearchRepositoryImpl extends CatalogSearchRepository {
  async findAllActiveServices() {
    const result = await query(
      `SELECT id, service_code, service_name, category_id, unit_price
       FROM services
       WHERE is_active = 1
       ORDER BY service_name`
    );
    return result.recordset;
  }

  async findAllActivePackagesWithItems() {
    const result = await query(
      `SELECT sp.id AS package_id, sp.package_code, sp.package_name, sp.category_id,
              sp.applicable_km, sp.total_price,
              s.id AS service_id, s.service_code, s.service_name, s.unit_price
       FROM   service_packages sp
       JOIN   service_package_items spi ON spi.package_id = sp.id
       JOIN   services s ON s.id = spi.service_id
       WHERE  sp.is_active = 1
       ORDER  BY sp.package_name, s.service_name`
    );
    return result.recordset;
  }
}

module.exports = CatalogSearchRepositoryImpl;
