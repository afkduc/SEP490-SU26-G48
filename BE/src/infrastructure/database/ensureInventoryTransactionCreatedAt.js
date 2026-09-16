const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cot inventory_transactions.created_at - GIO chinh xac cua tung giao dich
// kho. Truoc day chi co transaction_date (kieu date, khong co gio) nen bieu do
// lich su ton kho tung phu tung khong the xep thu tu dung trong cung 1 ngay.
//
// Backfill cho dong cu: giao dich xuat/hoan co pickup_id thi lay dung gio ky
// (export_request_pickups.signed_at); con lai (nhap kho cu) khong biet gio
// nen de 00:00 cua transaction_date - chap nhan duoc vi la du lieu demo.

const STEPS = [
  ['Them cot inventory_transactions.created_at', `
    IF COL_LENGTH('dbo.inventory_transactions','created_at') IS NULL
      ALTER TABLE dbo.inventory_transactions
        ADD created_at DATETIME NULL CONSTRAINT DF_inventory_transactions_created_at DEFAULT GETDATE();
  `],
  ['Backfill gio ky cho giao dich xuat/hoan da co pickup', `
    UPDATE it
    SET it.created_at = p.signed_at
    FROM dbo.inventory_transactions it
    JOIN dbo.export_request_pickups p ON p.id = it.pickup_id
    WHERE it.created_at IS NULL;
  `],
  ['Backfill 00:00 cua transaction_date cho cac dong con lai', `
    UPDATE dbo.inventory_transactions
    SET created_at = CAST(transaction_date AS DATETIME)
    WHERE created_at IS NULL;
  `],
];

async function alreadyDone(pool) {
  // Phai kiem tra 2 buoc: neu cot chua co ma SELECT thang WHERE created_at
  // IS NULL thi SQL Server bao "Invalid column name" ngay luc parse.
  const col = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.inventory_transactions','created_at') IS NOT NULL THEN 1 ELSE 0 END AS has_col`
  );
  if (col.recordset[0].has_col !== 1) return false;
  const r = await pool.request().query(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.inventory_transactions WHERE created_at IS NULL) THEN 0 ELSE 1 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureInventoryTransactionCreatedAt() {
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
    err.message = `[gio giao dich kho] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureInventoryTransactionCreatedAt, STEPS };
