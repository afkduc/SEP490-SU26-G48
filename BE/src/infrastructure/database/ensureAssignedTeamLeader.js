const sql = require('mssql');
const { getPool } = require('./sqlServer');

// repair_orders.assigned_team_leader_id -> users(id)
//
// Co van dich vu CHI DINH truoc 1 to truong cho phieu ngay luc luu. Phieu do
// chi hien o bang "Việc chờ nhận" cua dung to truong ay; khong chi dinh thi
// van hien chung cho ca chi nhanh nhu cu.
//
// Vi sao KHONG dung lai cot `team_leader_id` co san: cot do co nghia "AI DA
// NHAN viec" - duoc ghi luc to truong bam Nhan viec (claim), va la can cu cho
// hang loat kiem tra quyen sau do (chi to truong duoc phan cong moi tick dau
// muc / bao co van / bam Hoan thanh). Ghi truoc vao do thi phieu se hien nhu
// da co nguoi nhan trong khi chua ai dong vao xe, va cac buoc sau se mo khoa
// nham. Hai khai niem khac nhau thi phai la hai cot.
//
// NULL = khong chi dinh (moi to truong deu thay) - do la mac dinh, va cung la
// hanh vi cu nen toan bo phieu dang co giu nguyen cach hoat dong.

const STEPS = [
  ['Them cot repair_orders.assigned_team_leader_id', `
    IF COL_LENGTH('dbo.repair_orders','assigned_team_leader_id') IS NULL
      ALTER TABLE dbo.repair_orders ADD assigned_team_leader_id BIGINT NULL;
  `],
  ['Them khoa ngoai assigned_team_leader_id -> users', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE name = 'FK_repair_orders_assigned_team_leader')
      ALTER TABLE dbo.repair_orders
        ADD CONSTRAINT FK_repair_orders_assigned_team_leader
        FOREIGN KEY (assigned_team_leader_id) REFERENCES dbo.users(id);
  `],
  // Bang "Việc chờ nhận" loc theo (assigned IS NULL OR = minh) tren moi phieu
  // dang cho, nen loc nhieu hon han doc chi tiet.
  ['Them index cho bang Viec cho nhan', `
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'IX_repair_orders_assigned_team_leader')
      CREATE INDEX IX_repair_orders_assigned_team_leader
        ON dbo.repair_orders (assigned_team_leader_id)
        WHERE assigned_team_leader_id IS NOT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_orders','assigned_team_leader_id') IS NOT NULL
                 THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureAssignedTeamLeader() {
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
    err.message = `[chi dinh to truong] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureAssignedTeamLeader, STEPS };
