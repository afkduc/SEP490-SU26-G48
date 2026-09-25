const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Backfill inventory_transactions.requested_by cho du lieu CU (xuat/tra tu
// truoc khi co tinh nang nay - xem ensureInventoryTransactionRequestedBy.js).
// Ban dau CO Y de trong (khong doan) vi khong biet chinh xac lich su, nhung
// theo yeu cau thuc te: "dien dai vao roi tu sau se lam that" - phieu cu
// dien mot gia tri UOC LUONG hop ly thay vi de trong, cac phieu MOI tao SAU
// migration nay deu da duoc ghi THAT (chinh xac) qua confirmPickup roi nen
// khong bi dung lai.
//
// Uu tien 1: CVDV yeu cau cua chinh dong hang muc (product_id) trong cung
// Lenh sua chua do - dung lai gia tri da backfill o repair_order_items
// (ensureRepairOrderItemRequestedBy.js).
// Uu tien 2 (khong tim thay dong hang muc khop, vd hang muc do sau bi xoa
// khoi phieu): CVDV phu trach Lenh sua chua do (advisor_id).

const STEPS = [
  ['Backfill tu repair_order_items.requested_by (khop theo product_id)', `
    UPDATE it
    SET it.requested_by = (
      SELECT TOP 1 roi.requested_by
      FROM dbo.repair_order_items roi
      WHERE roi.repair_order_id = it.repair_order_id
        AND roi.product_id = it.product_id
        AND roi.requested_by IS NOT NULL
      ORDER BY roi.id DESC
    )
    FROM dbo.inventory_transactions it
    WHERE it.requested_by IS NULL
      AND it.repair_order_id IS NOT NULL
      AND it.product_id IS NOT NULL;
  `],
  ['Backfill con lai tu repair_orders.advisor_id', `
    UPDATE it
    SET it.requested_by = ro.advisor_id
    FROM dbo.inventory_transactions it
    JOIN dbo.repair_orders ro ON ro.id = it.repair_order_id
    WHERE it.requested_by IS NULL
      AND it.repair_order_id IS NOT NULL;
  `],
];

async function pendingCount(pool) {
  const r = await pool.request().query(
    `SELECT COUNT(*) AS n FROM dbo.inventory_transactions
     WHERE requested_by IS NULL AND repair_order_id IS NOT NULL`
  );
  return r.recordset[0].n;
}

async function ensureInventoryTransactionRequestedByBackfill() {
  const pool = await getPool();
  const pending = await pendingCount(pool);
  if (pending === 0) return { skipped: true, updated: 0 };

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
    err.message = `[backfill uoc luong CVDV yeu cau tren giao dich kho cu] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, updated: pending };
}

module.exports = { ensureInventoryTransactionRequestedByBackfill };
