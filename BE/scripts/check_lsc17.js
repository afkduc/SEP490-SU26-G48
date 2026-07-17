require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../src/config/env');
const sql = require('mssql');
const config = require('../src/config');

(async () => {
  const conn = await sql.connect(config.db);
  const result = await conn.request().query(`
    SELECT ro.id, ro.repair_code, ro.branch_id, ro.status, ro.created_at,
           (SELECT COUNT(*) FROM repair_order_tasks rot WHERE rot.repair_order_id = ro.id AND rot.task_type = 'PART' AND rot.product_id IS NOT NULL) AS part_count
    FROM repair_orders ro
    WHERE ro.repair_code = 'LSC-2026-017'
  `);
  console.log('LSC-2026-017:');
  console.table(result.recordset);

  const all = await conn.request().query(`SELECT id, repair_code, branch_id, status FROM repair_orders ORDER BY id DESC`);
  console.log('All repair orders (newest first):');
  console.table(all.recordset.slice(0, 20));
  await conn.close();
})();