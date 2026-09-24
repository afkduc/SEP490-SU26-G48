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
          // Cung bo du lieu (CCCD, ngay sinh, email, dia chi, MST, nguoi lien
          // he) va cung kiem tra trung email/CCCD nhu duong import Excel -
          // xem CustomerRepositoryImpl.importCustomerVehicleRow.
          if (newCustomer.email || newCustomer.cccd) {
            const conflict = await tx
              .request()
              .input('phone', sql.VarChar(20), newCustomer.phone)
              .input('email', sql.VarChar(100), newCustomer.email || null)
              .input('cccd', sql.VarChar(20), newCustomer.cccd || null)
              .query(`
                SELECT TOP 1
                  phone,
                  CASE WHEN @email IS NOT NULL AND email = @email THEN 1 ELSE 0 END AS email_match,
                  CASE WHEN @cccd IS NOT NULL AND cccd = @cccd THEN 1 ELSE 0 END AS cccd_match
                FROM customers
                WHERE phone <> @phone
                  AND ((@email IS NOT NULL AND email = @email) OR (@cccd IS NOT NULL AND cccd = @cccd))
              `);
            const row = conflict.recordset[0];
            if (row) {
              const field = row.email_match ? 'Email' : 'CCCD';
              throw new Error(`${field} đã được dùng bởi khách hàng khác (SĐT ${row.phone})`);
            }
          }

          const inserted = await tx
            .request()
            .input('fullName', sql.NVarChar(150), newCustomer.fullName)
            .input('phone', sql.VarChar(20), newCustomer.phone)
            .input('cccd', sql.VarChar(20), newCustomer.cccd || null)
            .input('dateOfBirth', sql.Date, newCustomer.dateOfBirth || null)
            .input('email', sql.VarChar(100), newCustomer.email || null)
            .input('address', sql.NVarChar(255), newCustomer.address || null)
            .input('taxCode', sql.VarChar(20), newCustomer.taxCode || null)
            .input('contactName', sql.NVarChar(100), newCustomer.contactName || null)
            .input('contactPhone', sql.VarChar(20), newCustomer.contactPhone || null)
            .query(`
              INSERT INTO customers (
                customer_code, full_name, phone, cccd, date_of_birth, email, address,
                tax_code, contact_name, contact_phone, created_at
              )
              OUTPUT inserted.id
              VALUES (
                '', @fullName, @phone, @cccd, @dateOfBirth, @email, @address,
                @taxCode, @contactName, @contactPhone, GETDATE()
              )
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
