const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Phieu xuat kho chuyen tu "tao 1 lan roi khoa" sang "theo doi lien tuc":
// 1 Lenh sua chua chi co DUNG 1 phieu xuat, nhung NV Kho co the quay lai
// nhieu lan de xuat them phu tung phat sinh hoac tra lai hang thua, cho den
// khi RO roi khoi trang thai waiting_repair/inprogress.
//
// Moi lan lay/tra hang la 1 dong `export_request_pickups` (co chu ky rieng
// cua tho lay lan do). Chi tiet tung phu tung cua lan do van ghi vao
// `inventory_transactions` nhu cu (transaction_type 'export'/'return'), them
// cot pickup_id de gom nhom dung theo tung lan.

const STEPS = [
  ['Tao bang export_request_pickups', `
    IF OBJECT_ID('dbo.export_request_pickups', 'U') IS NULL
    CREATE TABLE dbo.export_request_pickups (
      id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      export_request_id BIGINT NOT NULL,
      received_by BIGINT NOT NULL,
      signature_data NVARCHAR(MAX) NOT NULL,
      signed_at DATETIME NOT NULL,
      performed_by BIGINT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
  `],
  ['Them cot inventory_transactions.pickup_id', `
    IF COL_LENGTH('dbo.inventory_transactions','pickup_id') IS NULL
      ALTER TABLE dbo.inventory_transactions ADD pickup_id BIGINT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN OBJECT_ID('dbo.export_request_pickups', 'U') IS NOT NULL
                  AND COL_LENGTH('dbo.inventory_transactions','pickup_id') IS NOT NULL
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureExportPickups() {
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
    err.message = `[lich su lay hang phieu xuat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureExportPickups, STEPS };
