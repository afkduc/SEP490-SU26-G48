const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Chu ky cua NV KHO (nguoi xuat) tren phieu xuat: ky DUNG 1 LAN o lan xuat
// dau tien cua phieu, luu tren header export_requests. Cac lan xuat them /
// tra hang sau chi hien lai chu ky nay, KHONG ky lai - khac voi nguoi lay
// (tho) phai ky moi lan (export_request_pickups.signature_data).
//
// Phieu cu (tao truoc khi co cot nay) de NULL: FE se yeu cau NV kho ky bo
// sung o lan thao tac ke tiep.

const STEPS = [
  ['Them cot export_requests.issuer_signature_data', `
    IF COL_LENGTH('dbo.export_requests','issuer_signature_data') IS NULL
      ALTER TABLE dbo.export_requests ADD issuer_signature_data NVARCHAR(MAX) NULL;
  `],
  ['Them cot export_requests.issuer_signed_by', `
    IF COL_LENGTH('dbo.export_requests','issuer_signed_by') IS NULL
      ALTER TABLE dbo.export_requests ADD issuer_signed_by BIGINT NULL;
  `],
  ['Them cot export_requests.issuer_signed_at', `
    IF COL_LENGTH('dbo.export_requests','issuer_signed_at') IS NULL
      ALTER TABLE dbo.export_requests ADD issuer_signed_at DATETIME NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.export_requests','issuer_signature_data') IS NOT NULL
                  AND COL_LENGTH('dbo.export_requests','issuer_signed_by') IS NOT NULL
                  AND COL_LENGTH('dbo.export_requests','issuer_signed_at') IS NOT NULL
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureExportIssuerSignature() {
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
    err.message = `[chu ky NV kho tren phieu xuat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureExportIssuerSignature, STEPS };
