const CustomerRepository = require('../../domain/repositories/CustomerRepository');
const Customer = require('../../domain/entities/Customer');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

function genCustomerCode(id) {
  const year = new Date().getFullYear();
  return `KH-${year}-${String(id).padStart(4, '0')}`;
}

class CustomerRepositoryImpl extends CustomerRepository {
  // Lay het khach hang + xe + so lan lam dich vu - loc khong-dau tim kiem
  // duoc lam o tang Service (giong VehicleSearchService/InventoryService),
  // vi so luong khach hang chi vai tram dong.
  async findAllWithDetails() {
    const [customersResult, vehiclesResult, countsResult] = await Promise.all([
      query(`SELECT * FROM customers ORDER BY full_name`),
      query(`SELECT * FROM vehicles ORDER BY id`),
      query(`SELECT customer_id, COUNT(*) AS cnt FROM service_orders GROUP BY customer_id`),
    ]);

    const vehiclesByCustomer = new Map();
    for (const v of vehiclesResult.recordset) {
      if (!v.customer_id) continue;
      if (!vehiclesByCustomer.has(v.customer_id)) vehiclesByCustomer.set(v.customer_id, []);
      vehiclesByCustomer.get(v.customer_id).push(v);
    }
    const countByCustomer = new Map(countsResult.recordset.map((r) => [r.customer_id, r.cnt]));

    return customersResult.recordset.map((row) =>
      Customer.fromPersistence(row, vehiclesByCustomer.get(row.id) || [], countByCustomer.get(row.id) || 0)
    );
  }

  async findByIdWithDetails(id) {
    const customerResult = await query(`SELECT * FROM customers WHERE id = @id`, { id });
    const row = customerResult.recordset[0];
    if (!row) return null;

    const [vehiclesResult, countResult] = await Promise.all([
      query(`SELECT * FROM vehicles WHERE customer_id = @id ORDER BY id`, { id }),
      query(`SELECT COUNT(*) AS cnt FROM service_orders WHERE customer_id = @id`, { id }),
    ]);

    return Customer.fromPersistence(row, vehiclesResult.recordset, countResult.recordset[0].cnt);
  }

  async update(id, data) {
    await query(
      `UPDATE customers SET
         full_name = @fullName,
         phone = @phone,
         cccd = @cccd,
         date_of_birth = @dateOfBirth,
         email = @email,
         address = @address
       WHERE id = @id`,
      {
        id,
        fullName: data.fullName,
        phone: data.phone,
        cccd: data.cccd || null,
        dateOfBirth: data.dateOfBirth || null,
        email: data.email || null,
        address: data.address || null,
      }
    );

    return this.findByIdWithDetails(id);
  }

  // Dung cho import Excel: 1 dong = 1 khach hang + 1 xe. Neu SDT da ton tai thi
  // dung lai khach hang cu (khong tao trung), neu bien so da ton tai thi bo qua
  // phan tao xe (khong doi chu xe cua nguoi khac).
  async importCustomerVehicleRow(data) {
    return runInTransaction(async (tx) => {
      const existingCustomer = await tx
        .request()
        .input('phone', sql.VarChar(20), data.phone)
        .query(`SELECT id FROM customers WHERE phone = @phone`);

      let customerId = existingCustomer.recordset[0]?.id || null;
      let customerCreated = false;

      if (!customerId) {
        if (data.email || data.cccd) {
          const conflict = await tx
            .request()
            .input('phone', sql.VarChar(20), data.phone)
            .input('email', sql.VarChar(100), data.email || null)
            .input('cccd', sql.VarChar(20), data.cccd || null)
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
          .input('fullName', sql.NVarChar(150), data.fullName)
          .input('phone', sql.VarChar(20), data.phone)
          .input('cccd', sql.VarChar(20), data.cccd || null)
          .input('dateOfBirth', sql.Date, data.dateOfBirth || null)
          .input('email', sql.VarChar(100), data.email || null)
          .input('address', sql.NVarChar(255), data.address || null)
          .input('taxCode', sql.VarChar(20), data.taxCode || null)
          .input('contactName', sql.NVarChar(100), data.contactName || null)
          .input('contactPhone', sql.VarChar(20), data.contactPhone || null)
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
        customerCreated = true;
      }

      let vehicleCreated = false;
      let vehicleSkipped = false;
      let vehicleSkipReason = null;

      if (data.licensePlate) {
        const existingVehicle = await tx
          .request()
          .input('licensePlate', sql.VarChar(20), data.licensePlate)
          .input('frameNumber', sql.VarChar(50), data.frameNumber || null)
          .input('engineNumber', sql.VarChar(50), data.engineNumber || null)
          .query(`
            SELECT TOP 1
              CASE WHEN license_plate = @licensePlate THEN 1 ELSE 0 END AS plate_match,
              CASE WHEN @frameNumber IS NOT NULL AND frame_number = @frameNumber THEN 1 ELSE 0 END AS frame_match,
              CASE WHEN @engineNumber IS NOT NULL AND engine_number = @engineNumber THEN 1 ELSE 0 END AS engine_match
            FROM vehicles
            WHERE license_plate = @licensePlate
               OR (@frameNumber IS NOT NULL AND frame_number = @frameNumber)
               OR (@engineNumber IS NOT NULL AND engine_number = @engineNumber)
          `);

        const conflictRow = existingVehicle.recordset[0];
        if (conflictRow) {
          vehicleSkipped = true;
          if (conflictRow.plate_match) vehicleSkipReason = `Biển số ${data.licensePlate} đã tồn tại`;
          else if (conflictRow.frame_match) vehicleSkipReason = `Số khung ${data.frameNumber} đã tồn tại`;
          else vehicleSkipReason = `Số máy ${data.engineNumber} đã tồn tại`;
        } else {
          await tx
            .request()
            .input('licensePlate', sql.VarChar(20), data.licensePlate)
            .input('customerId', sql.BigInt, customerId)
            .input('vehicleModelText', sql.NVarChar(200), data.vehicleModel || null)
            .input('frameNumber', sql.VarChar(50), data.frameNumber || null)
            .input('engineNumber', sql.VarChar(50), data.engineNumber || null)
            .input('manufactureYear', sql.Int, data.manufactureYear || null)
            .input('color', sql.NVarChar(50), data.color || null)
            .input('currentKm', sql.Int, data.currentKm || 0)
            .query(`
              INSERT INTO vehicles (
                license_plate, customer_id, vehicle_model_text, frame_number, engine_number,
                manufacture_year, color, current_km
              )
              VALUES (
                @licensePlate, @customerId, @vehicleModelText, @frameNumber, @engineNumber,
                @manufactureYear, @color, @currentKm
              )
            `);
          vehicleCreated = true;
        }
      }

      return { customerId, customerCreated, vehicleCreated, vehicleSkipped, vehicleSkipReason };
    });
  }
}

module.exports = CustomerRepositoryImpl;
