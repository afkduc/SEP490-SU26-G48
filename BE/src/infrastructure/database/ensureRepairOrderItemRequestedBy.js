const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cot moi tren repair_order_items: AI la CVDV yeu cau dong hang muc nay -
// nguoi tao phieu ban dau (create), hoac nguoi sua phieu them/tang so luong
// dong do sau nay (update, hoac khach dong y thay dau muc NG). Dung de
// "Lich su luu phieu xuat" hien dung "CVDV yeu cau" cho tung lan xuat/tra
// (xem ExportRequestRepositoryImpl.confirmPickup/findPickups) - truoc day
// phai DOAN nguoc tu Nhat ky hoat dong theo thoi gian, sai khi 1 lan xuat
// gom hang muc cua NHIEU lan sua khac nhau. Gio luu THAT tai nguon, khong
// doan nua.
//
// Backfill du lieu cu: gan requested_by = advisor_id cua chinh Lenh sua chua
// (tot nhat co the biet duoc cho du lieu da co - khong biet chinh xac AI
// trong so cac lan sua truoc do, nhung nguoi tao/phu trach phieu la phong
// doan hop ly nhat, con hon de trong).

const STEPS = [
  ['Them cot repair_order_items.requested_by', `
    IF COL_LENGTH('dbo.repair_order_items','requested_by') IS NULL
      ALTER TABLE dbo.repair_order_items ADD requested_by BIGINT NULL;
  `],
  ['Backfill requested_by = advisor_id cua Lenh sua chua', `
    UPDATE roi
    SET roi.requested_by = ro.advisor_id
    FROM dbo.repair_order_items roi
    JOIN dbo.repair_orders ro ON ro.id = roi.repair_order_id
    WHERE roi.requested_by IS NULL;
  `],
];

async function alreadyDone(pool) {
  const col = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_order_items','requested_by') IS NOT NULL THEN 1 ELSE 0 END AS has_col`
  );
  if (col.recordset[0].has_col !== 1) return false;
  const r = await pool.request().query(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.repair_order_items WHERE requested_by IS NULL) THEN 0 ELSE 1 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureRepairOrderItemRequestedBy() {
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
    err.message = `[CVDV yeu cau tren hang muc phieu] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureRepairOrderItemRequestedBy, STEPS };
