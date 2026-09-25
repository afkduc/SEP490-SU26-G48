const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cot moi tren inventory_transactions: chup lai "CVDV yeu cau" (repair_order_items
// .requested_by) NGAY LUC xuat/tra - repair_order_items bi XOA VA CHEN LAI
// MOI (khong phai UPDATE) moi lan sua phieu (xem RepairSettlementRepositoryImpl
// .update), nen requested_by cua dong item CO THE doi sau khi da xuat. Phai
// chup lai (snapshot) tai thoi diem xuat thi lich su moi ON DINH - doc lai
// LIVE tu repair_order_items se bi sai neu phieu duoc sua tiep sau do.
//
// KHONG backfill du lieu cu (de NULL) - khong the biet chinh xac AI da yeu
// cau tung dong xuat cu trong qua khu, doan bay con te hon de trong.

const STEPS = [
  ['Them cot inventory_transactions.requested_by', `
    IF COL_LENGTH('dbo.inventory_transactions','requested_by') IS NULL
      ALTER TABLE dbo.inventory_transactions ADD requested_by BIGINT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.inventory_transactions','requested_by') IS NOT NULL
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureInventoryTransactionRequestedBy() {
  const pool = await getPool();
  if (await alreadyDone(pool)) return { skipped: true, steps: 0 };

  const tx = new sql.Transaction(pool);
  await tx.begin();
  const done = [];
  try {
    await tx.request().batch('SET XACT_ABORT ON;');
    for (const [label, statement] of STEPS) {
      await tx.request().batch(statement);
      done.push(label);
    }
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction da tu abort */ }
    err.message = `[snapshot CVDV yeu cau tren giao dich kho] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureInventoryTransactionRequestedBy, STEPS };
