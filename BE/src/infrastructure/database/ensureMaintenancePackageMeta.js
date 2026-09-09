const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Bo sung metadata cho GOI BAO DUONG DINH KY, bam theo dung bieu mau
// "Phu luc 3 - Phieu kiem tra BDDK" cua Mazda (2 sheet: MAD cho Sedan/SUV,
// Pick-up cho BT-50). Gom 3 viec doc lap nhau:
//
// 1) service_packages.model_id -> vehicle_models(id)
//    72 goi = 12 doi xe x 6 cap (1000km + Cap 1..5). Truoc day khong co gi
//    noi goi voi doi xe nen CVDV van chon nham goi CX-5 cho xe Mazda2. Duoi
//    ten goi VON DA la display_name cua doi xe ("... - Mazda2 1.5 Premium")
//    nen backfill khop dung 72/72, khong con dong nao NULL.
//
// 2) services.checklist_group / checklist_order
//    32 dau muc (MAD) va 35 dau muc (Pick-up) trong bieu mau duoc chia 5 nhom
//    cong viec. Nhom la thuoc tinh cua DAU MUC nen luu tren `services`, khong
//    luu tren service_package_items (2208 dong, lap lai vo ich).
//    checklist_order la so THU TU TOAN CUC (nhom*100 + so thu tu trong nhom)
//    de chi can 1 ORDER BY la ra dung thu tu bieu mau.
//    Doi chieu ten: 7 dau muc phu thuoc doi xe duoc dat ten kem duoi
//    " – <doi xe> [MA]" (vd "Loc dau dong co – Mazda2 1.5 Premium [MZ2]") nen
//    phai cat duoi truoc khi so khop. 42 ten goc phu kin ca 2 sheet.
//    Dich vu ngoai bao duong dinh ky (ve sinh noi that, son phu gam...) khong
//    nam trong bieu mau nay -> de NULL, FE xep vao muc "Hang muc khac".
//
// 3) repair_order_tasks: action_code / check_result / check_note /
//    checklist_group / checklist_order
//    action_code (I/R/M/V) truoc day bi vut di o tang ung dung: co san tren
//    service_package_items nhung khong theo duoc vao checklist cua to truong/
//    khoang sua, nen tho khong phan biet duoc "chi kiem tra" voi "phai thay".
//    Nhom cung duoc CHUP LAI len task (thay vi join nguoc ve catalog) de
//    checklist da chot khong doi theo catalog sau nay.
//    check_result = 'OK'/'NG' - cot KET QUA cua bieu mau, chi dung cho dau muc
//    kiem tra (I/V/M); dau muc R van la tick hoan thanh nhu cu.

const GROUPS = {
  1: 'Các bộ phận cơ bản của động cơ',
  2: 'Hệ thống điện khoang động cơ',
  3: 'Hệ thống nhiên liệu và kiểm soát khí xả',
  4: 'Gầm và thân xe',
  5: 'Điều hoà nhiệt độ/ga điều hoà',
};

// [ten goc dich vu, so thu tu toan cuc]. Hai ten cung mot so = cung 1 dau muc
// cua bieu mau nhung dat ten khac nhau giua xe xang va xe dau (vd "Dầu phanh"
// vs "Dầu phanh & dầu ly hợp") - co y giu cung thu tu.
const CHECKLIST_ITEMS = [
  ['Dầu động cơ & đệm làm kín bulông xả dầu', 101],
  ['Lọc dầu động cơ', 102],
  ['Nước làm mát động cơ', 103],
  ['Dây curoa dẫn động (bơm nước, máy nén ĐH, máy phát)', 104],
  ['Dây curoa dẫn động', 104],
  ['Khe hở supap', 105],
  ['Đường ống, đầu nối hệ thống sưởi ấm/làm mát', 106],
  ['Ống xả và giá đỡ ống xả', 107],

  ['Bugi đánh lửa', 201],
  ['Ắc quy', 202],
  ['Kim phun nhiên liệu và họng ga', 203],

  ['Lọc nhiên liệu', 301],
  ['Lọc gió động cơ', 302],
  ['Nắp bình nhiên liệu, đường ống nhiên liệu, van hơi xăng', 303],
  ['Nắp bình nhiên liệu, đường ống nhiên liệu', 303],
  ['Van thông gió các-te, đường ống, đầu nối', 304],
  ['Vệ sinh buồng đốt động cơ', 305],
  ['Vệ sinh buồng đốt động cơ Diesel', 305],

  ['Dầu phanh', 401],
  ['Dầu phanh & dầu ly hợp', 401],
  ['Hoạt động bàn đạp phanh, ly hợp, phanh đỗ', 402],
  ['Guốc phanh đỗ', 403],
  ['Đĩa phanh/trống phanh và má phanh/guốc phanh chính', 404],
  ['Mỡ bò chịu nhiệt bôi trơn ắc càng phanh, má phanh, guốc phanh', 405],
  ['Các ống dẫn hệ thống phanh và co nối', 406],
  ['Thước lái, vô-lăng, thanh dẫn động, cơ cấu lái, cao su chụp bụi', 407],
  ['Dầu trợ lực tay lái', 408],
  ['Trục các đăng, trục láp, cao su che bụi trục láp', 409],
  ['Trục các đăng AWD, trục láp, cao su che bụi trục láp', 409],
  ['Các khớp cầu và cao su che bụi', 410],
  ['Dầu hộp số tự động', 411],
  ['Dầu hộp số tự động/nhớt hộp số thường', 411],
  ['Dầu hộp số phụ', 412],
  ['Nhớt hộp số thường (NEW BT-50)', 413],
  ['Nhớt vi sai cầu trước, sau', 414],
  ['Hệ thống treo trước/sau, các ốc gầm', 415],
  ['Áp suất lốp, độ mòn lốp (đảo lốp mỗi 10.000km)', 416],
  ['Đèn, còi, gạt nước, rửa kính, rửa đèn, nước rửa kính', 417],
  ['Cơ cấu khóa cửa, nắp cốp, lên kính, đai an toàn, gương hậu', 418],

  ['Ga lạnh hệ thống điều hòa', 501],
  ['Máy nén hệ thống điều hòa', 502],
  ['Lọc gió điều hòa', 503],
];

const q = (s) => `N'${String(s).replace(/'/g, "''")}'`;

// VALUES (ten_goc, nhom, thu_tu) - dung cho MERGE-style UPDATE ... FROM JOIN.
const CHECKLIST_VALUES = CHECKLIST_ITEMS
  .map(([name, order]) => `(${q(name)}, ${q(GROUPS[Math.floor(order / 100)])}, ${order})`)
  .join(',\n      ');

// Ten dich vu phu thuoc doi xe co duoi " – <doi xe> [MA]" (dau gach EN DASH
// U+2013, khong phai gach ngang thuong) - cat di truoc khi so khop.
const BASE_NAME_EXPR = `
  CASE WHEN CHARINDEX(N' – ', s.service_name) > 0
       THEN LEFT(s.service_name, CHARINDEX(N' – ', s.service_name) - 1)
       ELSE s.service_name END`;

const STEPS = [
  ['Them cot service_packages.model_id', `
    IF COL_LENGTH('dbo.service_packages','model_id') IS NULL
      ALTER TABLE dbo.service_packages ADD model_id BIGINT NULL;
  `],
  ['Backfill service_packages.model_id theo duoi ten goi', `
    UPDATE sp SET model_id = vm.id
    FROM   dbo.service_packages sp
    JOIN   dbo.vehicle_models vm ON sp.package_name LIKE N'%- ' + vm.display_name
    WHERE  sp.model_id IS NULL;
  `],
  ['Them khoa ngoai service_packages -> vehicle_models', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE parent_object_id = OBJECT_ID('dbo.service_packages')
                     AND referenced_object_id = OBJECT_ID('dbo.vehicle_models'))
      ALTER TABLE dbo.service_packages
        ADD CONSTRAINT FK_service_packages_vehicle_models
        FOREIGN KEY (model_id) REFERENCES dbo.vehicle_models(id);
  `],

  ['Them cot services.checklist_group', `
    IF COL_LENGTH('dbo.services','checklist_group') IS NULL
      ALTER TABLE dbo.services ADD checklist_group NVARCHAR(120) NULL;
  `],
  ['Them cot services.checklist_order', `
    IF COL_LENGTH('dbo.services','checklist_order') IS NULL
      ALTER TABLE dbo.services ADD checklist_order INT NULL;
  `],
  ['Backfill nhom/thu tu cho 42 dau muc bieu mau BDDK', `
    UPDATE s
    SET    checklist_group = m.grp,
           checklist_order = m.ord
    FROM   dbo.services s
    JOIN   (VALUES
      ${CHECKLIST_VALUES}
    ) AS m(base, grp, ord) ON m.base = ${BASE_NAME_EXPR}
    WHERE  s.checklist_order IS NULL;
  `],

  ['Them cot repair_order_tasks.action_code', `
    IF COL_LENGTH('dbo.repair_order_tasks','action_code') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD action_code VARCHAR(4) NULL;
  `],
  ['Them cot repair_order_tasks.check_result', `
    IF COL_LENGTH('dbo.repair_order_tasks','check_result') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD check_result VARCHAR(4) NULL;
  `],
  ['Them cot repair_order_tasks.check_note', `
    IF COL_LENGTH('dbo.repair_order_tasks','check_note') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD check_note NVARCHAR(500) NULL;
  `],
  ['Them cot repair_order_tasks.checklist_group', `
    IF COL_LENGTH('dbo.repair_order_tasks','checklist_group') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD checklist_group NVARCHAR(120) NULL;
  `],
  ['Them cot repair_order_tasks.checklist_order', `
    IF COL_LENGTH('dbo.repair_order_tasks','checklist_order') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD checklist_order INT NULL;
  `],

  // Luu ca tren dong hang muc cua phieu quyet toan, khong chi tren checklist
  // cua to truong: co van mo lai phieu cu (hoac in phieu) van phai thay dung
  // "Thay the"/"Kiem tra..." cua tung dau muc, thay vi mat sach sau khi luu.
  ['Them cot repair_order_items.action_code', `
    IF COL_LENGTH('dbo.repair_order_items','action_code') IS NULL
      ALTER TABLE dbo.repair_order_items ADD action_code VARCHAR(4) NULL;
  `],
];

// Da lam xong khi ca 3 phan deu co mat (cot cuoi cung cua tung phan).
async function alreadyDone(pool) {
  const r = await pool.request().query(`
    SELECT CASE WHEN COL_LENGTH('dbo.service_packages','model_id') IS NOT NULL
                 AND COL_LENGTH('dbo.services','checklist_order') IS NOT NULL
                 AND COL_LENGTH('dbo.repair_order_tasks','checklist_order') IS NOT NULL
                 AND COL_LENGTH('dbo.repair_order_items','action_code') IS NOT NULL
                THEN 1 ELSE 0 END AS done`);
  return r.recordset[0].done === 1;
}

async function ensureMaintenancePackageMeta() {
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
    err.message = `[metadata goi bao duong] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

// STEPS duoc export de chay thu (dry-run) roi rollback truoc khi wire vao boot.
module.exports = { ensureMaintenancePackageMeta, STEPS, GROUPS, CHECKLIST_ITEMS };
