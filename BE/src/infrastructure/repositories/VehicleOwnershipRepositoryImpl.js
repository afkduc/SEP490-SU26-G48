const VehicleOwnershipRepository = require('../../domain/repositories/VehicleOwnershipRepository');
const VehicleOwner = require('../../domain/entities/VehicleOwner');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

function genCustomerCode(id) {
  const year = new Date().getFullYear();
  return `KH-${year}-${String(id).padStart(4, '0')}`;
}

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
  //
  // newCustomerId: chu moi la khach DA CO san trong he thong.
  // newCustomer: chu moi la khach CHUA CO - tao moi (hoac dung lai neu SDT da
  // ton tai, tranh tao trung), trong CUNG 1 transaction voi viec chuyen nhuong.
  async transferOwnership(vehicleId, { newCustomerId, newCustomer, transferDate, notes } = {}) {
    await runInTransaction(async (tx) => {
      let customerId = newCustomerId;

      if (!customerId && newCustomer) {
        const existing = await tx
          .request()
          .input('phone', sql.VarChar(20), newCustomer.phone)
          .query(`SELECT id FROM customers WHERE phone = @phone`);
        customerId = existing.recordset[0]?.id || null;

        if (!customerId) {
          const inserted = await tx
            .request()
            .input('fullName', sql.NVarChar(150), newCustomer.fullName)
            .input('phone', sql.VarChar(20), newCustomer.phone)
            .input('address', sql.NVarChar(255), newCustomer.address || null)
            .query(`
              INSERT INTO customers (customer_code, full_name, phone, address, created_at)
              OUTPUT inserted.id
              VALUES ('', @fullName, @phone, @address, GETDATE())
            `);
          customerId = inserted.recordset[0].id;
          await tx
            .request()
            .input('id', sql.BigInt, customerId)
            .input('code', sql.VarChar(20), genCustomerCode(customerId))
            .query(`UPDATE customers SET customer_code = @code WHERE id = @id`);
        }
      }

      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('transferDate', sql.Date, transferDate)
        .query(`UPDATE vehicle_owners SET end_date = @transferDate WHERE vehicle_id = @vehicleId AND end_date IS NULL`);

      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('customerId', sql.BigInt, customerId)
        .input('transferDate', sql.Date, transferDate)
        .input('notes', sql.NVarChar(500), notes || null)
        .query(`
          INSERT INTO vehicle_owners (vehicle_id, customer_id, start_date, notes)
          VALUES (@vehicleId, @customerId, @transferDate, @notes)
        `);

      await tx
        .request()
        .input('vehicleId', sql.BigInt, vehicleId)
        .input('customerId', sql.BigInt, customerId)
        .query(`UPDATE vehicles SET customer_id = @customerId WHERE id = @vehicleId`);
    });

    return this.findHistoryByVehicleId(vehicleId);
  }
}

module.exports = VehicleOwnershipRepositoryImpl;
