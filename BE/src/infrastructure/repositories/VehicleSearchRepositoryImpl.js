const VehicleSearchRepository = require('../../domain/repositories/VehicleSearchRepository');
const { query } = require('../database/sqlServer');

class VehicleSearchRepositoryImpl extends VehicleSearchRepository {
  // Lay het (khong loc WHERE) - viec loc khong-dau tieng Viet lam o tang
  // Service bang normalizeVietnamese, vi SQL Server LIKE phan biet dau
  // (Vietnamese_CI_AS chi bo dau co ban, khong gop u/ơ ve u/o hay đ ve d).
  async findAllCustomerVehicleRows() {
    const result = await query(
      `SELECT TOP 500
              c.id            AS customer_id,
              c.full_name,
              c.phone,
              c.address,
              c.tax_code,
              c.cccd,
              c.email,
              c.contact_name,
              c.contact_phone,
              v.id            AS vehicle_id,
              v.license_plate,
              v.vehicle_model_text,
              v.frame_number,
              v.engine_number,
              v.current_km,
              wr.purchase_date
       FROM   vehicles v
       JOIN   customers c ON c.id = v.customer_id
       OUTER APPLY (
           SELECT TOP 1 w.purchase_date
           FROM   warranty_records w
           WHERE  w.vehicle_id = v.id
           ORDER  BY w.purchase_date DESC
       ) wr
       ORDER  BY c.full_name`
    );
    return result.recordset;
  }
}

module.exports = VehicleSearchRepositoryImpl;
