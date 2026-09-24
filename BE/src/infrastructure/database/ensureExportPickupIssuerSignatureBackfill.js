const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Backfill 1 lan cho du lieu CU (tao truoc khi export_request_pickups co cot
// issuer_signature_data - xem ensureExportPickupIssuerSignature.js): luc do
// chu ky NV kho chi luu tren header export_requests, ghi CHINH XAC vao lan
// xuat DAU TIEN cua phieu (code cu chi cho phep NV kho ky 1 lan duy nhat, o
// lan xuat dau). Chep lai chu ky do vao dong pickup DAU TIEN (id nho nhat)
// cua tung phieu, de "Lich su luu phieu" hien du chu ky ca 2 ben ngay ca voi
// nhung lan xuat da luu tu truoc khi co tinh nang nay.
//
// Cac lan xuat SAU deploy nay deu bat buoc NV kho ky rieng (validateConfirmPickup)
// nen khong con dong nao thieu issuer_signature_data ngoai du lieu cu - script
// nay chi con viec khi con du lieu cu chua duoc chep, tu dong "het viec" sau
// lan chay dau.

const BACKFILL_SQL = `
  ;WITH first_pickup AS (
    SELECT pk.id, pk.export_request_id,
           ROW_NUMBER() OVER (PARTITION BY pk.export_request_id ORDER BY pk.id ASC) AS rn
    FROM dbo.export_request_pickups pk
  )
  UPDATE pk
  SET pk.issuer_signature_data = er.issuer_signature_data
  FROM dbo.export_request_pickups pk
  JOIN first_pickup fp ON fp.id = pk.id AND fp.rn = 1
  JOIN dbo.export_requests er ON er.id = pk.export_request_id
  WHERE pk.issuer_signature_data IS NULL
    AND er.issuer_signature_data IS NOT NULL;
`;

async function pendingCount(pool) {
  const r = await pool.request().query(`
    ;WITH first_pickup AS (
      SELECT pk.id, pk.export_request_id,
             ROW_NUMBER() OVER (PARTITION BY pk.export_request_id ORDER BY pk.id ASC) AS rn
      FROM dbo.export_request_pickups pk
    )
    SELECT COUNT(*) AS n
    FROM dbo.export_request_pickups pk
    JOIN first_pickup fp ON fp.id = pk.id AND fp.rn = 1
    JOIN dbo.export_requests er ON er.id = pk.export_request_id
    WHERE pk.issuer_signature_data IS NULL
      AND er.issuer_signature_data IS NOT NULL
  `);
  return r.recordset[0].n;
}

async function ensureExportPickupIssuerSignatureBackfill() {
  const pool = await getPool();
  const pending = await pendingCount(pool);
  if (pending === 0) return { skipped: true, updated: 0 };

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx.request().batch('SET XACT_ABORT ON;');
    await tx.request().batch(BACKFILL_SQL);
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction da tu abort */ }
    err.message = `[backfill chu ky NV kho lan xuat dau] hong (da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, updated: pending };
}

module.exports = { ensureExportPickupIssuerSignatureBackfill };
