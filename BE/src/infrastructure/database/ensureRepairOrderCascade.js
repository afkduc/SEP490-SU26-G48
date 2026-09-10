const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Xoa 1 phieu quyet toan thi cac bang CON cua no tu xoa theo (ON DELETE CASCADE).
//
// Truoc day moi khoa ngoai tro toi repair_orders deu la NO_ACTION, nen xoa 1
// phieu phai xoa tay dung thu tu 7 bang; sot 1 bang la SQL chan lai, hoac te
// hon la de lai dong mo coi tro toi phieu khong con ton tai.
//
// CHI cascade 4 bang la CON THUAN cua phieu - khong co phieu thi ban than
// chung vo nghia:
//   repair_order_items        hang muc cua phieu
//   repair_order_tasks        tien do cong viec
//   repair_order_technicians  tho duoc gan
//   maintenance_reminders     lich nhac bao duong sinh ra tu phieu
//
// CO Y GIU NGUYEN NO_ACTION cho 3 bang con lai:
//   invoices                hoa don da phat
//   inventory_transactions  giao dich xuat/nhap kho that
//   export_requests         phieu xuat kho
// Do la chung tu tien va kho - chung khong duoc bien mat im lang theo 1 lenh
// xoa phieu. De NO_ACTION thi SQL Server CHAN luon lenh xoa, buoc nguoi xoa
// phai nhin thay va tu quyet dinh xu ly chung tu do truoc. Do la hanh vi dung.

const BANG_CON = [
  ['repair_order_items', 'roi_order_fkey', 'repair_order_id'],
  ['repair_order_tasks', 'rot_order_fkey', 'repair_order_id'],
  ['repair_order_technicians', 'rotech_order_fkey', 'repair_order_id'],
  ['maintenance_reminders', 'mr_ro_fkey', 'repair_order_id'],
];

const STEPS = BANG_CON.map(([bang, fk, cot]) => ([
  `Cho ${bang} tu xoa theo phieu`,
  `
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = '${fk}')
      ALTER TABLE dbo.${bang} DROP CONSTRAINT ${fk};
    ALTER TABLE dbo.${bang}
      ADD CONSTRAINT ${fk} FOREIGN KEY (${cot})
      REFERENCES dbo.repair_orders(id) ON DELETE CASCADE;
  `,
]));

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT COUNT(*) AS n
     FROM   sys.foreign_keys
     WHERE  name IN (${BANG_CON.map(([, fk]) => `'${fk}'`).join(',')})
       AND  delete_referential_action_desc = 'CASCADE'`
  );
  return r.recordset[0].n === BANG_CON.length;
}

async function ensureRepairOrderCascade() {
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
    err.message = `[cascade xoa phieu] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureRepairOrderCascade, STEPS };
