const sql = require('mssql');
const { getPool } = require('./sqlServer');

// To truong TU CHOI nhan viec do co van chi dinh (kem ly do).
//
// Truoc day co van chi dinh to truong (assigned_team_leader_id, xem
// ensureAssignedTeamLeader.js) la xong - to truong khong co duong nao noi
// "toi khong nhan duoc viec nay" ngoai cach goi dien. Phieu nam im o bang
// "Việc chờ nhận" cua dung nguoi do, khong ai khac thay, va co van khong biet.
//
//   assignment_declined_by     ai tu choi (phai la to truong dang duoc chi dinh)
//   assignment_declined_reason ly do - bat buoc nhap, co van doc de quyet dinh
//   assignment_declined_at     luc tu choi
//
// Sau khi tu choi, phieu BIEN MAT khoi bang "Việc chờ nhận" cua moi to truong
// (ke ca nguoi vua tu choi) - no quay ve tay co van. Co van co 2 lua chon:
//
//   - doi sang to truong khac  -> assigned_team_leader_id = nguoi moi
//   - day lai cho tat ca       -> assigned_team_leader_id = NULL
//
// Ca 2 deu XOA 3 cot nay ve NULL: ly do tu choi cu khong con y nghia voi
// nguoi nhan moi, va neu khong xoa thi phieu se bi loc mat vinh vien.
//
// Khong tach bang rieng: moi phieu chi giu duoc 1 lan tu choi gan nhat, va
// them bang moi thi phai sua lai ERD + Data Dictionary trong tai lieu da gan
// xong. Lich su day du cua cac lan tu choi van co trong audit_logs
// (lifecycle step 'assignment_declined').

const COT = [
  ['assignment_declined_by', 'BIGINT'],
  ['assignment_declined_reason', 'NVARCHAR(500)'],
  ['assignment_declined_at', 'DATETIME'],
];

const STEPS = [
  ...COT.map(([ten, kieu]) => ([
    `Them cot repair_orders.${ten}`,
    `
      IF COL_LENGTH('dbo.repair_orders','${ten}') IS NULL
        ALTER TABLE dbo.repair_orders ADD ${ten} ${kieu} NULL;
    `,
  ])),
  ['Them khoa ngoai assignment_declined_by -> users', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE name = 'FK_repair_orders_assignment_declined_by')
      ALTER TABLE dbo.repair_orders
        ADD CONSTRAINT FK_repair_orders_assignment_declined_by
        FOREIGN KEY (assignment_declined_by) REFERENCES dbo.users(id);
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_orders','assignment_declined_at') IS NOT NULL
                 THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureAssignmentDecline() {
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
    err.message = `[tu choi nhan viec] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureAssignmentDecline, STEPS, COT };
