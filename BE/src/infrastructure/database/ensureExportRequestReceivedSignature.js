const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cot export_requests.received_signature_data/received_signed_at - luu CHINH
// tay THO (nguoi lay) ky xac nhan da nhan phu tung khi tao phieu xuat, giong
// het co che khach hang ky tren phieu quyet toan (repair_orders.signature_data)
// - de biet chac chan AI la nguoi da lay hang, khong chi ghi ten qua dropdown.

const STEPS = [
  ['Them cot export_requests.received_signature_data', `
    IF COL_LENGTH('dbo.export_requests','received_signature_data') IS NULL
      ALTER TABLE dbo.export_requests ADD received_signature_data NVARCHAR(MAX) NULL;
  `],
  ['Them cot export_requests.received_signed_at', `
    IF COL_LENGTH('dbo.export_requests','received_signed_at') IS NULL
      ALTER TABLE dbo.export_requests ADD received_signed_at DATETIME NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.export_requests','received_signature_data') IS NOT NULL
                  AND COL_LENGTH('dbo.export_requests','received_signed_at') IS NOT NULL
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureExportRequestReceivedSignature() {
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
    err.message = `[chu ky nguoi lay phieu xuat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureExportRequestReceivedSignature, STEPS };
