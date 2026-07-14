const VehicleOwnershipRepository = require('../../domain/repositories/VehicleOwnershipRepository');
const VehicleOwner = require('../../domain/entities/VehicleOwner');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

class VehicleOwnershipRepositoryImpl extends VehicleOwnershipRepository {
  async findHistoryByVehicleId(vehicleId) {
    const result = await query(
      `SELECT vo.*, c.full_name AS customer_full_name, c.phone AS customer_phone
       FROM   vehicle_owners vo
       JOIN   customers c ON c.id = vo.customer_id
       WHERE  vo.vehicle_id = @vehicleId
       ORDER  BY vo.id ASC`,
      { vehicleId }
    );
    return result.recordset.map((row) => VehicleOwner.fromPersistence(row));
  }

  // Dong ky ghi so huu dang mo (end_date IS NULL), them ky ghi moi cho chu
  // moi, va cap nhat vehicles.customer_id de cac truy van "xe cua khach hang
  // hien tai" (CustomerRepositoryImpl) luon phan anh dung chu so huu moi nhat.
  async transferOwnership(vehicleId, { newCustomerId, transferDate, notes } = {}) {
    await runInTransaction(async (tx) => {
      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('transferDate', sql.Date, transferDate)
        .query(`UPDATE vehicle_owners SET end_date = @transferDate WHERE vehicle_id = @vehicleId AND end_date IS NULL`);

      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('customerId', sql.BigInt, newCustomerId)
        .input('transferDate', sql.Date, transferDate)
        .input('notes', sql.NVarChar(500), notes || null)
        .query(`
          INSERT INTO vehicle_owners (vehicle_id, customer_id, start_date, notes)
          VALUES (@vehicleId, @customerId, @transferDate, @notes)
        `);

      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('customerId', sql.BigInt, newCustomerId)
        .query(`UPDATE vehicles SET customer_id = @customerId WHERE id = @vehicleId`);
    });

    return this.findHistoryByVehicleId(vehicleId);
  }
}

module.exports = VehicleOwnershipRepositoryImpl;
