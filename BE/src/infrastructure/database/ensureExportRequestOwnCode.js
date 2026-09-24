const sql = require('mssql');
const { getPool } = require('./sqlServer');

// export_requests.request_code truoc day LUON la ban sao y het ma cua Lenh
// sua chua (repair_orders.repair_code, vd "RO-2026-10139") - cot "Ma phieu"
// va cot "Phieu sua chua" tren danh sach Phieu xuat kho vi vay hien y het
// nhau, nhin nham nhu bi loi trung. 1 RO thuc te co the gan voi nhieu loai
// phieu khac nhau ve sau (nhap/xuat/hoa don...) nen phieu xuat can ma RIENG
// cua no, khong muon chung voi ma RO - xem
// ExportRequestRepositoryImpl._getNextExportRequestCode (dang ERB-{chi
// nhanh}-{ngay}-{so thu tu}, cung kieu voi ma phieu nhap IRB-...).
//
// Backfill cho phieu xuat CU (tao truoc khi doi sang ma rieng): danh lai so
// thu tu theo dung thu tu tao (id tang dan) trong tung chi nhanh + tung
// ngay tao, y het cach ma moi duoc sinh.

const BACKFILL_SQL = `
  ;WITH to_fix AS (
    SELECT id, branch_id,
           'ERB-' + CAST(branch_id AS VARCHAR(20)) + '-'
             + FORMAT(COALESCE(created_at, CAST(export_date AS DATETIME), GETDATE()), 'yyyyMMdd') + '-' AS prefix,
           ROW_NUMBER() OVER (
             PARTITION BY branch_id, FORMAT(COALESCE(created_at, CAST(export_date AS DATETIME), GETDATE()), 'yyyyMMdd')
             ORDER BY id ASC
           ) AS rn
    FROM dbo.export_requests
    WHERE request_code NOT LIKE 'ERB-%'
  )
  UPDATE er
  SET er.request_code = tf.prefix + RIGHT('0000' + CAST(tf.rn AS VARCHAR(4)), 4)
  FROM dbo.export_requests er
  JOIN to_fix tf ON tf.id = er.id;
`;

async function pendingCount(pool) {
  const r = await pool.request().query(
    `SELECT COUNT(*) AS n FROM dbo.export_requests WHERE request_code NOT LIKE 'ERB-%'`
  );
  return r.recordset[0].n;
}

async function ensureExportRequestOwnCode() {
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
    err.message = `[ma phieu xuat rieng] backfill hong (da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, updated: pending };
}

module.exports = { ensureExportRequestOwnCode };
