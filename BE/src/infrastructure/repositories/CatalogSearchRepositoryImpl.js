const CatalogSearchRepository = require('../../domain/repositories/CatalogSearchRepository');
const { query } = require('../database/sqlServer');

// Catalog (services + service_packages) rat nho (vai chuc dong), nen lay het
// roi loc/khong-dau-hoa o tang Service thay vi loc bang SQL LIKE - vi
// COLLATE ..._CI_AI cua SQL Server khong gop ư/ơ ve u/o hay đ ve d.
class CatalogSearchRepositoryImpl extends CatalogSearchRepository {
  async findAllActiveServices(branchId) {
    const result = await query(
      `SELECT id, service_code, service_name, category_id, unit_price, repair_category
       FROM services
       WHERE is_active = 1 AND branch_id = @branchId
       ORDER BY service_name`,
      { branchId: Number(branchId) }
    );
    return result.recordset;
  }

  async findAllActivePackagesWithItems(branchId) {
    const result = await query(
      `SELECT sp.id AS package_id, sp.package_code, sp.package_name, sp.category_id,
              sp.applicable_km, sp.total_price, sp.repair_category AS package_repair_category,
              s.id AS service_id, s.service_code, s.service_name, s.unit_price, s.repair_category AS service_repair_category
       FROM   service_packages sp
       JOIN   service_package_items spi ON spi.package_id = sp.id
       JOIN   services s ON s.id = spi.service_id
       WHERE  sp.is_active = 1 AND s.is_active = 1 AND sp.branch_id = @branchId
       ORDER  BY sp.package_name, s.service_name`,
      { branchId: Number(branchId) }
    );
    return result.recordset;
  }

  // Dinh muc phu tung (BOM) cua tung dich vu - dung de auto-fill dong phu tung
  // ngay khi cho van chon 1 dich vu/goi combo trong phieu quyet toan.
  async findAllServiceParts(branchId) {
    const result = await query(
      `SELECT sprt.service_id, sprt.product_id, sprt.quantity,
              p.product_code, p.product_name, p.unit_price AS product_unit_price,
              p.stock_quantity, u.unit_name
       FROM   service_parts sprt
       JOIN   products p ON p.id = sprt.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE  p.branch_id = @branchId`,
      { branchId: Number(branchId) }
    );
    return result.recordset;
  }
}

module.exports = CatalogSearchRepositoryImpl;
