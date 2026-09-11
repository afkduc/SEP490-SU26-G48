const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Tach buoc "khoang xe bao xong viec" khoi buoc "to truong xac nhan hoan
// thanh". Truoc day khoang bam Hoan thanh la phieu quyet toan nhay thang sang
// 'waiting_payment' (CVDV thay ngay "Cho thanh toan") - khong ai kiem tra lai
// truoc khi bao khach den tra tien.
//
// Gio:
//   khoang bam Hoan thanh -> chi ghi bay_completed_at, status VAN 'inprogress'
//   to truong bam Xac nhan -> status -> 'waiting_payment' nhu cu
//
// Khong them gia tri status moi (tranh phai sua tab/badge/bo loc khap man
// CVDV): trang thai "cho to truong xac nhan" duoc SUY RA tu (status =
// 'inprogress' AND bay_completed_at IS NOT NULL) - xem repairStatusOf trong
// RepairOrderRepositoryImpl.js. Nho vay khoang xe cung van "dang ban" cho den
// khi to truong xac nhan (vehicle_bays loc theo status='inprogress'), dung
// thuc te: xe van nam trong khoang cho den luc ban giao.
//
// Cot de NULL cho moi dong cu: lenh dang lam do se can khoang bam Hoan thanh
// mot lan nhu binh thuong, khong ket dong o trang thai la nao.

const STEPS = [
  ['Them cot repair_orders.bay_completed_at', `
    IF COL_LENGTH('dbo.repair_orders','bay_completed_at') IS NULL
      ALTER TABLE dbo.repair_orders ADD bay_completed_at DATETIME NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_orders','bay_completed_at') IS NOT NULL THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureBayCompletionConfirm() {
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
    err.message = `[xac nhan hoan thanh] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureBayCompletionConfirm, STEPS };
