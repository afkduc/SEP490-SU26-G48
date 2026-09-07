const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Xu ly dau muc "Khong dat" (NG) - tinh huong dau muc CHI CAN KIEM TRA nhung
// tho phat hien phai THAY.
//
// Truoc day tho cham Khong dat xong thi... het. Khong ai bao co van, co van
// khong co cho ghi da hoi khach chua, va to truong van bam Hoan thanh duoc -
// xe ra khoi xuong trong khi khach chua he duoc bao. Sau nay hong that thi
// gara khong co gi chung minh da khuyen cao.
//
// Luong dung:
//   tho cham Khong dat        -> ng_decision = 'pending' (cho hoi khach)
//   co van goi khach, khach dong y -> 'accepted', roi them phu tung vao phieu
//   khach tu choi                  -> 'declined' + ng_note (bat buoc ghi ly do)
//   con dau muc 'pending'          -> to truong KHONG bam Hoan thanh duoc
//
// Dau muc bi tu choi van tinh tien CONG KIEM TRA - nhung cong do da nam trong
// gia goi bao duong roi nen khong phai tinh them gi, chi ghi nhan de in vao
// muc "CAC HANG MUC CAN LAM SOM" cua bieu mau.
//
// ng_decision de NULL cho dau muc binh thuong (khong phai NG) - chi dau muc
// co check_result = 'NG' moi mang gia tri.

const STEPS = [
  ['Them cot repair_order_tasks.ng_decision', `
    IF COL_LENGTH('dbo.repair_order_tasks','ng_decision') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD ng_decision VARCHAR(10) NULL;
  `],
  ['Them cot repair_order_tasks.ng_note', `
    IF COL_LENGTH('dbo.repair_order_tasks','ng_note') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD ng_note NVARCHAR(500) NULL;
  `],
  ['Them cot repair_order_tasks.ng_decided_by', `
    IF COL_LENGTH('dbo.repair_order_tasks','ng_decided_by') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD ng_decided_by BIGINT NULL;
  `],
  ['Them cot repair_order_tasks.ng_decided_at', `
    IF COL_LENGTH('dbo.repair_order_tasks','ng_decided_at') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD ng_decided_at DATETIME NULL;
  `],
  // Dau muc DA cham Khong dat truoc khi co tinh nang nay -> dat ve 'pending'
  // de co van con thay ma xu ly, thay vi bi bo quen im lang.
  ['Danh dau cac dau muc Khong dat cu la "cho hoi khach"', `
    UPDATE dbo.repair_order_tasks
    SET    ng_decision = 'pending'
    WHERE  check_result = 'NG' AND ng_decision IS NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_order_tasks','ng_decided_at') IS NOT NULL THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureNgDecision() {
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
    err.message = `[xu ly dau muc khong dat] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureNgDecision, STEPS };
