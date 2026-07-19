/**
 * Seed: Add PART tasks to existing repair orders for export request testing
 * Run: node scripts/seed_repair_orders.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../src/config/env');
const sql = require('mssql');
const config = require('../src/config');

async function seed() {
  const conn = await sql.connect(config.db);

  try {
    // Get products
    const products = await conn.request().query(`
      SELECT TOP 5 id, product_code, product_name
      FROM products WHERE status = 'active'
    `);

    if (products.recordset.length === 0) {
      console.log('No active products found.');
      return;
    }

    console.log(`Found ${products.recordset.length} products`);

    // Get repair orders without PART tasks
    const repairOrders = await conn.request().query(`
      SELECT ro.id, ro.repair_code
      FROM repair_orders ro
      WHERE ro.status IN ('pending', 'inprogress')
        AND NOT EXISTS (
          SELECT 1 FROM repair_order_tasks rot
          WHERE rot.repair_order_id = ro.id AND rot.task_type = 'PART'
        )
    `);

    console.log(`Found ${repairOrders.recordset.length} repair orders without PART tasks`);

    const partNames = ['Thay lọc dầu', 'Thay lọc gió', 'Thay bugi', 'Thay dầu máy', 'Thay lốp'];

    for (const ro of repairOrders.recordset) {
      console.log(`Processing repair order: ${ro.repair_code}`);

      for (let i = 0; i < Math.min(2, products.recordset.length); i++) {
        const product = products.recordset[i];
        const quantity = Math.floor(Math.random() * 3) + 1;

        await conn.request()
          .input('repairOrderId', sql.BigInt, ro.id)
          .input('taskName', sql.NVarChar(200), partNames[i % partNames.length])
          .input('productId', sql.BigInt, product.id)
          .input('quantity', sql.Int, quantity)
          .query(`
            INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, is_done)
            VALUES (@repairOrderId, @taskName, 'PART', @productId, @quantity, 0)
          `);

        console.log(`  + Task: ${partNames[i % partNames.length]} (product: ${product.product_code}, qty: ${quantity})`);
      }
    }

    console.log('\nDone! Repair orders now have PART tasks for export testing.');

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await conn.close();
  }
}

seed();
