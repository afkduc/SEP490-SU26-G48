const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cot export_requests.received_by - luu THO nao chiu trach nhiem nhan phu
// tung khi NV Kho tao phieu xuat (thay cho o "Ghi chu" tu do, khong ro trach
// nhiem).

const STEPS = [
  ['Them cot export_requests.received_by', `
    IF COL_LENGTH('dbo.export_requests','received_by') IS NULL
      ALTER TABLE dbo.export_requests ADD received_by BIGINT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.export_requests','received_by') IS NOT NULL THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureExportRequestReceivedBy() {
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
    err.message = `[tho nhan hang phieu xuat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureExportRequestReceivedBy, STEPS };
