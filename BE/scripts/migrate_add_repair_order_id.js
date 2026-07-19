/**
 * Migration: Add repair_order_id column to export_requests table
 * Run: node scripts/migrate_add_repair_order_id.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../src/config/env');
const sql = require('mssql');
const config = require('../src/config');

async function migrate() {
  const conn = await sql.connect(config.db);
  const request = conn.request();

  try {
    // Check if column exists
    const result = await request.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'export_requests' AND COLUMN_NAME = 'repair_order_id'
    `);

    if (result.recordset.length > 0) {
      console.log('Column repair_order_id already exists in export_requests.');
    } else {
      // Add column (nullable first, then update existing rows)
      await request.query(`
        ALTER TABLE export_requests
        ADD repair_order_id BIGINT NULL
      `);
      console.log('Added column repair_order_id to export_requests.');

      // Add foreign key constraint
      await request.query(`
        ALTER TABLE export_requests
        ADD CONSTRAINT FK_export_requests_repair_orders
        FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id)
      `);
      console.log('Added foreign key constraint FK_export_requests_repair_orders.');
    }

    // Check if index exists
    const indexResult = await request.query(`
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_export_requests_repair_order_id'
        AND object_id = OBJECT_ID('export_requests')
    `);

    if (indexResult.recordset.length === 0) {
      await request.query(`
        CREATE INDEX IX_export_requests_repair_order_id
        ON export_requests(repair_order_id)
      `);
      console.log('Created index IX_export_requests_repair_order_id.');
    } else {
      console.log('Index IX_export_requests_repair_order_id already exists.');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    if (err.number === 2714) { // Object already exists
      console.log('Object already exists, skipping...');
    } else {
      console.error('Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await conn.close();
  }
}

migrate();
