const sql = require('mssql');
const { getPool } = require('./sqlServer');

// GOP BANG: bo bang `repair_orders` cu (lenh sua chua) va doi ten
// `service_orders` -> `repair_orders`, de moi phieu chi con DUNG 1 MA
// `RO-YYYY-NNN` xuyen suot tu luc tiep nhan xe den luc xuat hoa don.
//
// Truoc day co 2 ma cho cung 1 viec: `service_orders.order_code` ("RO-...")
// cap luc tiep nhan, va `repair_orders.repair_code` ("LSC-...") sinh them luc
// to truong nhan viec. Ma LSC khach hang khong bao gio biet, chi gay nhap
// nhang noi bo -> bo han.
//
// Bang `repair_orders` cu thuc chat la BAN SAO BONG cua service_orders
// (branch/vehicle/team_leader/cancel_reason deu trung, status chi la anh xa
// 1-1: inprogress<->inprogress, completed<->waiting_payment/invoiced,
// cancelled<->cancelled). Chi 5 thong tin la RIENG cua no nen duoc chuyen
// thanh cot moi: bay_id, repair_started_at, repair_completed_at,
// repair_notes, repair_created_by.
//
// AN TOAN:
//  - Chay TRON VEN trong 1 transaction (XACT_ABORT ON) - hong la rollback het.
//  - Idempotent: da migrate roi thi thoat ngay (khong con bang service_orders).
//  - KHONG drop bang cu - chi doi ten thanh `repair_orders_legacy`. Viec DROP
//    la buoc thu cong rieng, sau khi da chay that on (xem dropLegacySql()).
//  - Loi thi THROW ra ngoai de BE tu choi khoi dong, thay vi chay tiep voi
//    schema nua voi nua (xem src/index.js).

// 1 phieu tung co the co NHIEU dong repair_orders (luong cu: khach huy giua
// chung -> phieu tra ve "waiting_repair" -> to truong khac nhan lai, sinh
// dong moi). Quy tac chon dong "hien hanh" duoi day DUNG BANG quy tac code
// van dang dung o moi noi truoc khi gop (xem RepairOrderRepositoryImpl
// .findByServiceOrderCode va RepairSettlementRepositoryImpl HEADER_SELECT):
// uu tien dong CHUA HUY, khong co thi lay id lon nhat.
const WINNER_RULE = `
  ROW_NUMBER() OVER (
    PARTITION BY service_order_id
    ORDER BY CASE WHEN status <> 'cancelled' THEN 0 ELSE 1 END, id DESC
  )
`;

// Moi buoc la 1 batch RIENG (khong gop chung 1 chuoi) vi SQL Server bien dich
// ca batch mot luc: neu ALTER TABLE ADD cot roi dung cot do ngay trong cung
// batch se bao "Invalid column name".
const STEPS = [
  ['Doi ten bang cu -> repair_orders_legacy', `
    IF OBJECT_ID('dbo.repair_orders','U') IS NOT NULL
       AND OBJECT_ID('dbo.repair_orders_legacy','U') IS NULL
      EXEC sp_rename 'dbo.repair_orders', 'repair_orders_legacy';
  `],

  ['Chon dong lenh sua chua "hien hanh" cho tung phieu', `
    IF OBJECT_ID('tempdb..#winner') IS NOT NULL DROP TABLE #winner;
    SELECT legacy_id, so_id
    INTO   #winner
    FROM (
      SELECT id AS legacy_id, service_order_id AS so_id, ${WINNER_RULE} AS rn
      FROM   dbo.repair_orders_legacy
      WHERE  service_order_id IS NOT NULL
    ) t
    WHERE t.rn = 1;
  `],

  ['Them cot bay_id', `IF COL_LENGTH('dbo.service_orders','bay_id') IS NULL ALTER TABLE dbo.service_orders ADD bay_id BIGINT NULL;`],
  ['Them cot repair_started_at', `IF COL_LENGTH('dbo.service_orders','repair_started_at') IS NULL ALTER TABLE dbo.service_orders ADD repair_started_at DATETIME NULL;`],
  ['Them cot repair_completed_at', `IF COL_LENGTH('dbo.service_orders','repair_completed_at') IS NULL ALTER TABLE dbo.service_orders ADD repair_completed_at DATETIME NULL;`],
  ['Them cot repair_notes', `IF COL_LENGTH('dbo.service_orders','repair_notes') IS NULL ALTER TABLE dbo.service_orders ADD repair_notes NVARCHAR(500) NULL;`],
  ['Them cot repair_created_by', `IF COL_LENGTH('dbo.service_orders','repair_created_by') IS NULL ALTER TABLE dbo.service_orders ADD repair_created_by BIGINT NULL;`],

  ['Chuyen du lieu rieng cua lenh sua chua sang phieu', `
    UPDATE so
    SET    so.bay_id              = l.bay_id,
           so.repair_started_at   = l.created_at,
           so.repair_completed_at = l.completed_at,
           so.repair_notes        = l.notes,
           so.repair_created_by   = l.created_by
    FROM   dbo.service_orders so
    JOIN   #winner w             ON w.so_id = so.id
    JOIN   dbo.repair_orders_legacy l ON l.id = w.legacy_id;
  `],

  // 9 phieu (deu la phieu da huy) dang de trong team_leader_id du lenh sua
  // chua cua no co - vi luong cu tra phieu ve "waiting_repair" thi xoa luon
  // to truong. Lay lai tu lenh de khong mat thong tin ai da tung nhan.
  ['Bu team_leader_id con thieu tu lenh sua chua', `
    UPDATE so
    SET    so.team_leader_id = l.team_leader_id
    FROM   dbo.service_orders so
    JOIN   #winner w             ON w.so_id = so.id
    JOIN   dbo.repair_orders_legacy l ON l.id = w.legacy_id
    WHERE  so.team_leader_id IS NULL AND l.team_leader_id IS NOT NULL;
  `],

  ['Bo khoa ngoai cu cua repair_order_tasks', `
    IF OBJECT_ID('dbo.rot_order_fkey','F') IS NOT NULL
      ALTER TABLE dbo.repair_order_tasks DROP CONSTRAINT rot_order_fkey;
  `],
  ['Bo khoa ngoai cu cua export_requests', `
    IF OBJECT_ID('dbo.FK_export_requests_repair_orders','F') IS NOT NULL
      ALTER TABLE dbo.export_requests DROP CONSTRAINT FK_export_requests_repair_orders;
  `],

  // Dau muc/tho thuoc cac dong lenh "thua" (khong duoc chon o #winner) khong
  // con cha de gan vao - neu giu lai va remap thi phieu se bi nhan doi danh
  // sach dau muc. Toan bo so nay nam tren phieu DA HUY (da doi chieu du lieu
  // that truoc khi chay), nen bo di khong mat gi co y nghia.
  ['Xoa dau muc thuoc lenh thua', `
    DELETE t FROM dbo.repair_order_tasks t
    LEFT JOIN #winner w ON w.legacy_id = t.repair_order_id
    WHERE w.legacy_id IS NULL;
  `],
  ['Xoa tho thuoc lenh thua', `
    DELETE x FROM dbo.repair_order_technicians x
    LEFT JOIN #winner w ON w.legacy_id = x.repair_order_id
    WHERE w.legacy_id IS NULL;
  `],
  // Chan truoc kha nang vi pham UNIQUE(repair_order_id, technician_id) sau
  // khi doi id - phong ho, buoc xoa "lenh thua" o tren da xu ly ca truong
  // hop da biet.
  ['Khu trung tho truoc khi doi id', `
    ;WITH d AS (
      SELECT x.id, ROW_NUMBER() OVER (PARTITION BY w.so_id, x.technician_id ORDER BY x.id) AS rn
      FROM   dbo.repair_order_technicians x
      JOIN   #winner w ON w.legacy_id = x.repair_order_id
    )
    DELETE FROM dbo.repair_order_technicians WHERE id IN (SELECT id FROM d WHERE rn > 1);
  `],

  ['Tro dau muc sang id phieu', `
    UPDATE t SET t.repair_order_id = w.so_id
    FROM dbo.repair_order_tasks t JOIN #winner w ON w.legacy_id = t.repair_order_id;
  `],
  ['Tro tho sang id phieu', `
    UPDATE x SET x.repair_order_id = w.so_id
    FROM dbo.repair_order_technicians x JOIN #winner w ON w.legacy_id = x.repair_order_id;
  `],

  ['Bu service_order_id cho phieu xuat kho', `
    UPDATE er SET er.service_order_id = l.service_order_id
    FROM   dbo.export_requests er
    JOIN   dbo.repair_orders_legacy l ON l.id = er.repair_order_id
    WHERE  er.service_order_id IS NULL AND l.service_order_id IS NOT NULL;
  `],
  ['Bo index cu cua export_requests', `
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_export_requests_repair_order_id' AND object_id=OBJECT_ID('dbo.export_requests'))
      DROP INDEX IX_export_requests_repair_order_id ON dbo.export_requests;
  `],
  ['Bo cot repair_order_id cu cua export_requests', `
    IF COL_LENGTH('dbo.export_requests','repair_order_id') IS NOT NULL
      ALTER TABLE dbo.export_requests DROP COLUMN repair_order_id;
  `],

  ['Doi ten service_orders -> repair_orders', `
    IF OBJECT_ID('dbo.service_orders','U') IS NOT NULL AND OBJECT_ID('dbo.repair_orders','U') IS NULL
      EXEC sp_rename 'dbo.service_orders', 'repair_orders';
  `],
  ['Doi ten service_order_items -> repair_order_items', `
    IF OBJECT_ID('dbo.service_order_items','U') IS NOT NULL AND OBJECT_ID('dbo.repair_order_items','U') IS NULL
      EXEC sp_rename 'dbo.service_order_items', 'repair_order_items';
  `],

  // Doi order_code -> repair_code cho khop ten bang moi, va tien the het luon
  // nhap nhang voi payos_transactions.order_code (cot do la ma giao dich cua
  // PayOS - dang so timestamp, khac nghia hoan toan).
  ['Doi ten cot order_code -> repair_code', `
    IF COL_LENGTH('dbo.repair_orders','order_code') IS NOT NULL
       AND COL_LENGTH('dbo.repair_orders','repair_code') IS NULL
      EXEC sp_rename 'dbo.repair_orders.order_code', 'repair_code', 'COLUMN';
  `],
];

// 6 bang dang tro ve phieu bang cot `service_order_id` - doi het sang
// `repair_order_id` cho khop ten bang moi.
const RENAME_FK_COLUMN_TABLES = [
  'repair_order_items',
  'export_requests',
  'inventory_transactions',
  'invoices',
  'maintenance_reminders',
  'payos_transactions',
];

const FINAL_STEPS = [
  ['Dung lai khoa ngoai repair_order_tasks -> repair_orders', `
    IF OBJECT_ID('dbo.rot_order_fkey','F') IS NULL
      ALTER TABLE dbo.repair_order_tasks WITH CHECK
        ADD CONSTRAINT rot_order_fkey FOREIGN KEY (repair_order_id) REFERENCES dbo.repair_orders(id);
  `],
  // Truoc day bang nay khong he co khoa ngoai - them luon cho chat, du lieu
  // vua duoc lam sach o cac buoc tren nen add duoc voi WITH CHECK.
  ['Them khoa ngoai repair_order_technicians -> repair_orders', `
    IF OBJECT_ID('dbo.rotech_order_fkey','F') IS NULL
      ALTER TABLE dbo.repair_order_technicians WITH CHECK
        ADD CONSTRAINT rotech_order_fkey FOREIGN KEY (repair_order_id) REFERENCES dbo.repair_orders(id);
  `],
];

function renameColumnStep(table) {
  return [`Doi cot service_order_id -> repair_order_id (${table})`, `
    IF COL_LENGTH('dbo.${table}','service_order_id') IS NOT NULL
       AND COL_LENGTH('dbo.${table}','repair_order_id') IS NULL
      EXEC sp_rename 'dbo.${table}.service_order_id', 'repair_order_id', 'COLUMN';
  `];
}

async function alreadyMerged(pool) {
  const r = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.service_orders','U') IS NULL
                 AND OBJECT_ID('dbo.repair_orders','U') IS NOT NULL
                 AND COL_LENGTH('dbo.repair_orders','repair_code') IS NOT NULL
                THEN 1 ELSE 0 END AS done`);
  return r.recordset[0].done === 1;
}

async function ensureRepairOrderMerge() {
  const pool = await getPool();
  if (await alreadyMerged(pool)) return { skipped: true };

  const steps = [
    ...STEPS,
    ...RENAME_FK_COLUMN_TABLES.map(renameColumnStep),
    ...FINAL_STEPS,
  ];

  const tx = new sql.Transaction(pool);
  await tx.begin();
  const done = [];
  try {
    // XACT_ABORT ON: bat ky loi runtime nao cung rollback ca transaction,
    // khong de sot lai nua chung.
    await tx.request().batch('SET XACT_ABORT ON;');
    for (const [label, statement] of steps) {
      await tx.request().batch(statement);
      done.push(label);
    }
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction da tu abort */ }
    err.message = `[gop repair_orders] hong o buoc "${done.length + 1}. ${steps[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${steps.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

// Buoc 2 - DA CHAY XONG ngay 25/08/2026: bang `repair_orders_legacy` (50 dong,
// khong bang nao tro vao) da duoc DROP. Giu lai ham nay de neu co moi truong
// khac (may thanh vien khac, DB dung thu) van con ket bang legacy thi don not.
// Muon lay lai du lieu cu: restore ban backup truoc khi gop, file
// /var/opt/mssql/data/AutoGaraDB_premerge_20260824162018.bak
function dropLegacySql() {
  return `
    IF OBJECT_ID('dbo.repair_orders_legacy','U') IS NOT NULL
      DROP TABLE dbo.repair_orders_legacy;
  `;
}

module.exports = { ensureRepairOrderMerge, dropLegacySql };
