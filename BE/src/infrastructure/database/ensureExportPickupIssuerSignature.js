const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Chu ky NV Kho (nguoi xuat) truoc day chi ky 1 LAN cho ca phieu, luu tren
// header export_requests.issuer_signature_data (xem ensureExportIssuerSignature.js)
// - lan xuat sau khong ky lai. Thuc te khac nhau: lan dau co the la NV kho A
// xuat, lan sau lai la NV kho B - phai ky lai MOI LAN de biet dung ai da dua
// hang, khong the dung chung 1 chu ky cu cho tat ca cac lan.
//
// Them cot nay tren export_request_pickups (1 dong = 1 lan xac nhan xuat/tra)
// de luu chu ky NV kho cua TUNG lan, giong het cach signature_data (nguoi lay)
// da luu tren bang nay tu truoc.

const STEPS = [
  ['Them cot export_request_pickups.issuer_signature_data', `
    IF COL_LENGTH('dbo.export_request_pickups','issuer_signature_data') IS NULL
      ALTER TABLE dbo.export_request_pickups ADD issuer_signature_data NVARCHAR(MAX) NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.export_request_pickups','issuer_signature_data') IS NOT NULL
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureExportPickupIssuerSignature() {
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
    err.message = `[chu ky NV kho theo tung lan xuat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureExportPickupIssuerSignature, STEPS };
