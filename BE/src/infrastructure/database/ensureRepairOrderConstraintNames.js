const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Dat lai TEN cho cac rang buoc/index tren 2 bang vua doi ten
// (service_orders -> repair_orders, service_order_items -> repair_order_items,
// xem ensureRepairOrderMerge.js). `sp_rename` chi doi ten BANG, khong doi ten
// cac object con, nen sau khi gop chung van mang tien to cu: so_pkey,
// soi_order_fkey, idx_so_branch, service_order_items_repair_category_chk...
//
// THUAN TUY THAM MY - khong anh huong gi den hanh vi, chi de nguoi doc schema
// sau nay khong bi roi. Chay trong 1 transaction, idempotent (bo qua neu ten
// cu khong con hoac ten moi da ton tai).
//
// Luu y: cac ten dich (ro_pkey, ro_branch_fkey...) truoc day thuoc bang
// repair_orders CU - bang do da bi DROP nen ten da duoc giai phong.

// Ten co dinh: old -> new
const OBJECT_RENAMES = [
  // repair_orders (was service_orders)
  ['so_pkey', 'ro_pkey'],
  ['so_code_uq', 'ro_code_uq'],
  ['so_advisor_fkey', 'ro_advisor_fkey'],
  ['so_branch_fkey', 'ro_branch_fkey'],
  ['so_customer_fkey', 'ro_customer_fkey'],
  ['so_leader_fkey', 'ro_leader_fkey'],
  ['so_vehicle_fkey', 'ro_vehicle_fkey'],
  ['service_orders_locked_by_fkey', 'ro_locked_by_fkey'],
  // repair_order_items (was service_order_items)
  ['soi_pkey', 'roi_pkey'],
  ['soi_order_fkey', 'roi_order_fkey'],
  ['soi_product_fkey', 'roi_product_fkey'],
  ['soi_service_fkey', 'roi_service_fkey'],
  ['service_order_items_repair_category_chk', 'roi_repair_category_chk'],
  // Khoa ngoai tu bang khac tro VE phieu
  ['er_so_fkey', 'er_ro_fkey'],
  ['it_so_fkey', 'it_ro_fkey'],
  ['inv_so_fkey', 'inv_ro_fkey'],
  ['mr_service_order_fkey', 'mr_ro_fkey'],
];

// Index: [bang, old, new]
const INDEX_RENAMES = [
  ['repair_orders', 'idx_so_branch', 'idx_ro_branch'],
  ['repair_orders', 'idx_so_customer', 'idx_ro_customer'],
  ['repair_orders', 'idx_so_status', 'idx_ro_status'],
  ['repair_orders', 'idx_so_vehicle', 'idx_ro_vehicle'],
  ['repair_order_items', 'idx_soi_order', 'idx_roi_order'],
];

// DEFAULT constraint SQL Server tu dat ten (DF__service_o__statu__6BE40491) -
// khong doi cung duoc nhung nhin rat kho hieu. Doi theo cot ma no gan vao, ten
// moi deterministic: DF_<bang>_<cot>.
const DEFAULT_TABLES = ['repair_orders', 'repair_order_items'];

async function ensureRepairOrderConstraintNames() {
  const pool = await getPool();
  // Chua gop thi khong co gi de doi
  const ready = await pool.request().query(
    `SELECT CASE WHEN OBJECT_ID('dbo.repair_orders','U') IS NOT NULL
                  AND OBJECT_ID('dbo.repair_order_items','U') IS NOT NULL
                 THEN 1 ELSE 0 END AS ok`
  );
  if (!ready.recordset[0].ok) return { skipped: true, renamed: 0 };

  const tx = new sql.Transaction(pool);
  await tx.begin();
  const done = [];
  try {
    await tx.request().batch('SET XACT_ABORT ON;');

    for (const [oldName, newName] of OBJECT_RENAMES) {
      const chk = await tx.request()
        .input('o', sql.NVarChar(128), oldName)
        .input('n', sql.NVarChar(128), newName)
        .query(`SELECT CASE WHEN OBJECT_ID('dbo.' + @o) IS NOT NULL
                             AND OBJECT_ID('dbo.' + @n) IS NULL
                            THEN 1 ELSE 0 END AS go`);
      if (!chk.recordset[0].go) continue;
      await tx.request().batch(`EXEC sp_rename N'dbo.${oldName}', N'${newName}', N'OBJECT';`);
      done.push(`${oldName} -> ${newName}`);
    }

    for (const [table, oldName, newName] of INDEX_RENAMES) {
      const chk = await tx.request()
        .input('t', sql.NVarChar(128), table)
        .input('o', sql.NVarChar(128), oldName)
        .input('n', sql.NVarChar(128), newName)
        .query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.'+@t) AND name=@o)
                             AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.'+@t) AND name=@n)
                            THEN 1 ELSE 0 END AS go`);
      if (!chk.recordset[0].go) continue;
      await tx.request().batch(`EXEC sp_rename N'dbo.${table}.${oldName}', N'${newName}', N'INDEX';`);
      done.push(`${table}.${oldName} -> ${newName}`);
    }

    for (const table of DEFAULT_TABLES) {
      const rows = await tx.request()
        .input('t', sql.NVarChar(128), table)
        .query(`SELECT dc.name AS old_name, c.name AS col
                FROM sys.default_constraints dc
                JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID('dbo.' + @t)
                  AND dc.name LIKE 'DF@_@_%' ESCAPE '@'`);
      for (const r of rows.recordset) {
        const newName = `DF_${table}_${r.col}`;
        const chk = await tx.request().input('n', sql.NVarChar(128), newName)
          .query(`SELECT CASE WHEN OBJECT_ID('dbo.' + @n) IS NULL THEN 1 ELSE 0 END AS go`);
        if (!chk.recordset[0].go) continue;
        await tx.request().batch(`EXEC sp_rename N'dbo.[${r.old_name}]', N'${newName}', N'OBJECT';`);
        done.push(`${r.old_name} -> ${newName}`);
      }
    }

    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction da tu abort */ }
    err.message = `[doi ten rang buoc] hong sau khi doi ${done.length} cai (da rollback het): ${err.message}`;
    throw err;
  }
  return { skipped: false, renamed: done.length, details: done };
}

module.exports = { ensureRepairOrderConstraintNames };
