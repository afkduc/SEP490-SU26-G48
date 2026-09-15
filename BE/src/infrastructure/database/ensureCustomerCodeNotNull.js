const sql = require('mssql');
const { getPool } = require('./sqlServer');

// customers.customer_code bat buoc phai co - la ma hien thi cho nguoi dung
// (VD "KH-2026-0007"), khong khach nao duoc de trong. Code tao khach o ca 3
// noi (CustomerRepositoryImpl x2, VehicleOwnershipRepositoryImpl) deu INSERT
// '' roi UPDATE ma ngay trong cung transaction, nen siet NOT NULL o DB an
// toan; backfill phong ho cho moi truong khac neu con dong NULL.

const STEPS = [
  ['Backfill ma cho khach con NULL/rong (neu co)', `
    UPDATE dbo.customers
    SET customer_code = 'KH-' + CAST(YEAR(ISNULL(created_at, GETDATE())) AS VARCHAR(4)) + '-' + RIGHT('0000' + CAST(id AS VARCHAR(10)), 4)
    WHERE customer_code IS NULL OR LTRIM(RTRIM(customer_code)) = '';
  `],
  ['Siet customers.customer_code NOT NULL', `
    ALTER TABLE dbo.customers ALTER COLUMN customer_code VARCHAR(20) NOT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN IS_NULLABLE = 'NO' THEN 1 ELSE 0 END AS done
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'customer_code'`
  );
  return r.recordset[0]?.done === 1;
}

async function ensureCustomerCodeNotNull() {
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
    err.message = `[ma khach hang bat buoc] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureCustomerCodeNotNull, STEPS };
