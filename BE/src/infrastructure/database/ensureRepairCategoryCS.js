const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Cho phep loai hinh sua chua 'CS' (Cham soc xe) o repair_order_items va
// service_packages.
//
// 'CS' duoc them vao danh sach hop le cua FE + BE (REPAIR_CATEGORY_VALUES) va
// 23 dich vu trong catalog da duoc gan 'CS', nhung rang buoc CHECK cua
// `repair_order_items` thi VAN chi cho ER/CB/EE/BP/PM. Ket qua: co van chon
// bat ky dich vu "Cham soc xe" nao, luu phieu la no van qua duoc validate cua
// BE roi chet o cau INSERT, nem nguyen chuoi loi SQL len man hinh:
//
//   The INSERT statement conflicted with the CHECK constraint
//   "roi_repair_category_chk" ... column 'repair_category'
//
// `services` da duoc mo cho 'CS' tu truoc, chi con 2 bang nay bo sot.
//
// service_packages hien chi co 'PM' nhung van mo luon cho dong bo - de 3 bang
// cung mot tap gia tri, khong phai nho bang nao noi bang nao chat.

const DINH_NGHIA = `[repair_category] IS NULL OR [repair_category] IN ('ER','CB','EE','BP','PM','CS')`;

const STEPS = [
  ['Mo rong rang buoc repair_order_items.repair_category cho CS', `
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'roi_repair_category_chk')
      ALTER TABLE dbo.repair_order_items DROP CONSTRAINT roi_repair_category_chk;
    ALTER TABLE dbo.repair_order_items
      ADD CONSTRAINT roi_repair_category_chk CHECK (${DINH_NGHIA});
  `],
  ['Mo rong rang buoc service_packages.repair_category cho CS', `
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'service_packages_repair_category_chk')
      ALTER TABLE dbo.service_packages DROP CONSTRAINT service_packages_repair_category_chk;
    ALTER TABLE dbo.service_packages
      ADD CONSTRAINT service_packages_repair_category_chk CHECK (${DINH_NGHIA});
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN EXISTS (
              SELECT 1 FROM sys.check_constraints
              WHERE name = 'roi_repair_category_chk' AND definition LIKE '%CS%')
            THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureRepairCategoryCS() {
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
    err.message = `[loai hinh sua chua CS] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureRepairCategoryCS, STEPS };
