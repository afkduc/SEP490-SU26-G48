const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Khai bao khoa ngoai cho 9 bang tu truoc den nay chi "noi bang id trong code"
// ma khong co FOREIGN KEY trong DB. App van chay vi moi JOIN deu dung id luu
// trong cot, nhung thieu FK nen da sinh ra dong mo coi (thong bao cua user da
// xoa, link PayOS cua lenh da xoa, khoang xe cua to truong da xoa...) va SSMS
// diagram / ERD ve cac bang nay dung mot minh.
//
// Quy tac ON DELETE - theo dung tinh than cac FK dang co trong DB:
//   CASCADE   4 bang "con thuan" cua users (khong co user thi vo nghia):
//             login_sessions, security_alerts, notifications,
//             password_reset_tokens - giong user_notification_settings san co.
//   SET NULL  repair_orders.bay_id: to truong bo so khoang se DELETE
//             vehicle_bays (VehicleBayRepositoryImpl.setBayNumbers); lenh cu
//             tung dung khoang do chi mat tham chieu khoang, khong bi chan.
//   NO ACTION con lai: ai da ky/nhan hang/thuc hien phieu thi khong duoc xoa
//             cung user do; chung tu kho, PayOS khong bien mat im lang.
//
// CO Y KHONG them FK cho audit_logs.user_id: log kiem toan phai giu nguyen ke
// ca khi tai khoan bi xoa (dang co ~276 dong log cua user da xoa - do la du
// lieu dung, khong phai rac). Chi noi audit_logs.branch_id -> branches (chi
// nhanh khong bao gio bi xoa) de ERD khong con bang nao dung mot minh.
//
// Truoc khi them FK phai don dong mo coi, neu khong SQL Server tu choi:
//   DELETE   dong con thuan / link PayOS pending cua lenh da xoa / khoang xe
//            cua to truong da xoa (setBayNumbers coi moi dong co
//            team_leader_id khac minh - ke ca NULL - la "thuoc to truong khac",
//            nen set NULL se lam so khoang do ket vinh vien -> phai xoa).
//   SET NULL cot nullable chi la tham chieu phu (chu ky NV kho, pickup, khoang).
//
// password_reset_tokens.user_id dang la INT trong khi users.id la BIGINT -
// SQL Server bat buoc cung kieu moi tao FK duoc -> doi sang BIGINT truoc.

// [bang con, cot, bang cha, ten FK, ON DELETE, cach don mo coi]
const FKS = [
  ['login_sessions', 'user_id', 'users', 'fk_login_sessions_user', 'CASCADE', 'DELETE'],
  ['security_alerts', 'user_id', 'users', 'fk_security_alerts_user', 'CASCADE', 'DELETE'],
  ['security_alerts', 'branch_id', 'branches', 'fk_security_alerts_branch', 'NO ACTION', 'SET NULL'],
  ['notifications', 'user_id', 'users', 'fk_notifications_user', 'CASCADE', 'DELETE'],
  ['password_reset_tokens', 'user_id', 'users', 'fk_password_reset_tokens_user', 'CASCADE', 'DELETE'],
  ['payos_transactions', 'repair_order_id', 'repair_orders', 'fk_payos_transactions_repair_order', 'NO ACTION', 'DELETE'],
  ['export_request_pickups', 'export_request_id', 'export_requests', 'fk_export_request_pickups_export_request', 'NO ACTION', 'DELETE'],
  ['export_request_pickups', 'received_by', 'users', 'fk_export_request_pickups_received_by', 'NO ACTION', 'DELETE'],
  ['export_request_pickups', 'performed_by', 'users', 'fk_export_request_pickups_performed_by', 'NO ACTION', 'DELETE'],
  ['vehicle_bays', 'branch_id', 'branches', 'fk_vehicle_bays_branch', 'NO ACTION', 'DELETE'],
  ['vehicle_bays', 'team_leader_id', 'users', 'fk_vehicle_bays_team_leader', 'NO ACTION', 'DELETE'],
  ['inventory_transactions', 'pickup_id', 'export_request_pickups', 'fk_inventory_transactions_pickup', 'NO ACTION', 'SET NULL'],
  ['export_requests', 'issuer_signed_by', 'users', 'fk_export_requests_issuer_signed_by', 'NO ACTION', 'SET NULL'],
  ['repair_orders', 'bay_id', 'vehicle_bays', 'fk_repair_orders_bay', 'SET NULL', 'SET NULL'],
  ['audit_logs', 'branch_id', 'branches', 'fk_audit_logs_branch', 'NO ACTION', 'SET NULL'],
];

// Bang co the chua ton tai (password_reset_tokens duoc PasswordResetService tao
// lazy) -> bo qua, lan khoi dong sau se them.
const guard = (bang, body) => `IF OBJECT_ID('dbo.${bang}', 'U') IS NOT NULL BEGIN ${body} END;`;

const STEPS = [
  [
    'password_reset_tokens.user_id INT -> BIGINT (cung kieu voi users.id)',
    guard('password_reset_tokens', `
      IF EXISTS (SELECT 1 FROM sys.columns
                 WHERE object_id = OBJECT_ID('dbo.password_reset_tokens')
                   AND name = 'user_id' AND system_type_id = TYPE_ID('int'))
      BEGIN
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_prt_user_id'
                     AND object_id = OBJECT_ID('dbo.password_reset_tokens'))
          DROP INDEX IX_prt_user_id ON dbo.password_reset_tokens;
        ALTER TABLE dbo.password_reset_tokens ALTER COLUMN user_id BIGINT NOT NULL;
        CREATE INDEX IX_prt_user_id ON dbo.password_reset_tokens(user_id);
      END
    `),
  ],
  ...FKS.map(([bang, cot, cha, fk, onDelete, don]) => ([
    `${bang}.${cot} -> ${cha} (${fk})`,
    guard(bang, `
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = '${fk}')
      BEGIN
        ${don === 'DELETE'
          ? `DELETE c FROM dbo.${bang} c LEFT JOIN dbo.${cha} p ON p.id = c.${cot}
             WHERE c.${cot} IS NOT NULL AND p.id IS NULL;`
          : `UPDATE c SET ${cot} = NULL FROM dbo.${bang} c LEFT JOIN dbo.${cha} p ON p.id = c.${cot}
             WHERE c.${cot} IS NOT NULL AND p.id IS NULL;`}
        ALTER TABLE dbo.${bang}
          ADD CONSTRAINT ${fk} FOREIGN KEY (${cot})
          REFERENCES dbo.${cha}(id) ON DELETE ${onDelete};
      END
    `),
  ])),
];

// Dem mo coi tung FK (chi doc) - de log ra nhung gi sap bi don, va de test.
async function countOrphans(request) {
  const out = [];
  for (const [bang, cot, cha, fk, , don] of FKS) {
    const r = await request.query(
      `SELECT CASE WHEN OBJECT_ID('dbo.${bang}', 'U') IS NULL THEN -1
              ELSE (SELECT COUNT(*) FROM dbo.${bang} c LEFT JOIN dbo.${cha} p ON p.id = c.${cot}
                    WHERE c.${cot} IS NOT NULL AND p.id IS NULL) END AS n`
    );
    const n = r.recordset[0].n;
    if (n > 0) out.push({ fk, bang, cot, n, don });
  }
  return out;
}

async function alreadyDone(pool) {
  // "xong" = moi FK ma bang con DANG TON TAI deu da co (bang chua tao thi
  // chua tinh; khi no xuat hien, lan khoi dong sau se them not).
  const co = await pool.request().query(
    `SELECT COUNT(*) AS n FROM sys.foreign_keys
     WHERE name IN (${FKS.map(([, , , fk]) => `'${fk}'`).join(',')})`
  );
  const bang = await pool.request().query(
    `SELECT name FROM sys.tables
     WHERE name IN (${[...new Set(FKS.map(([b]) => b))].map((b) => `'${b}'`).join(',')})`
  );
  const tonTai = new Set(bang.recordset.map((r) => r.name));
  const expected = FKS.filter(([b]) => tonTai.has(b)).length;
  return co.recordset[0].n >= expected;
}

async function ensureMissingForeignKeys() {
  const pool = await getPool();
  if (await alreadyDone(pool)) return { skipped: true, steps: 0, cleaned: [] };

  const cleaned = await countOrphans(pool.request());
  for (const c of cleaned) {
    console.log(`[BE] khoa ngoai: don ${c.n} dong mo coi ${c.bang}.${c.cot} (${c.don})`);
  }

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
    err.message = `[khoa ngoai con thieu] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length, cleaned };
}

module.exports = { ensureMissingForeignKeys, countOrphans, FKS, STEPS };
