require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../src/config/env');
const sql = require('mssql');
const config = require('../src/config');

(async () => {
  const conn = await sql.connect(config.db);
  // Test query tuong duong trong BE
  const where = [
    `ro.branch_id = @branchId`,
    `ro.status IN ('pending','inprogress')`,
  ];
  const sqlText = `
    SELECT
      ro.id,
      ro.repair_code AS repair_order_code,
      ro.status,
      ro.branch_id,
      (
        SELECT COUNT(*) FROM repair_order_tasks rot
        WHERE rot.repair_order_id = ro.id AND rot.task_type = 'PART' AND rot.product_id IS NOT NULL
      ) AS part_task_count
    FROM repair_orders ro
    WHERE ${where.join(' AND ')}
    ORDER BY ro.id DESC
  `;
  const result = await conn.request()
    .input('branchId', sql.Int, 1)
    .query(sqlText);
  console.log('Branch 1 exportable LSC:');
  console.table(result.recordset);
  await conn.close();
})();