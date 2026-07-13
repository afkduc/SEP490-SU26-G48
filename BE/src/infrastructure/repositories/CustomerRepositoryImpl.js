const CustomerRepository = require('../../domain/repositories/CustomerRepository');
const Customer = require('../../domain/entities/Customer');
const { query } = require('../database/sqlServer');

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
}

module.exports = CustomerRepositoryImpl;
