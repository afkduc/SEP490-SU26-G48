const VehicleSearchRepository = require('../../domain/repositories/VehicleSearchRepository');
const { query } = require('../database/sqlServer');

class VehicleSearchRepositoryImpl extends VehicleSearchRepository {
  async searchByCustomerOrVehicle(term) {
    const result = await query(
      `SELECT TOP 10
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
       WHERE  c.full_name     LIKE @term
          OR  c.phone         LIKE @term
          OR  v.license_plate LIKE @term
          OR  v.frame_number  LIKE @term
          OR  v.engine_number LIKE @term
       ORDER  BY c.full_name`,
      { term: `%${term}%` }
    );
    return result.recordset;
  }
}

module.exports = VehicleSearchRepositoryImpl;
