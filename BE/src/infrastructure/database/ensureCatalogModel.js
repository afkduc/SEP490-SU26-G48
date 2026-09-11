const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Gan DOI XE cho dich vu le va phu tung: services.model_id / products.model_id
// -> vehicle_models(id).
//
// ensureMaintenancePackageMeta da lam viec nay cho service_packages, nhung chi
// GOI moi duoc gan doi xe. Dich vu le va phu tung thi khong, nen o form quyet
// toan go "phanh" cho 1 chiec CX-8 van hien ra "Guoc phanh do - Mazda BT-50",
// "- Mazda CX-3", "- Mazda CX-5"... Co van rat de chon nham phu tung cua doi
// xe khac, ma nham phu tung thi tho lap khong vua, phai lam lai tu dau.
//
// Ten trong catalog VON DA chua display_name cua doi xe, chi khac quy uoc dau:
//   dich vu : "Guoc phanh do – Mazda CX-8 2.5 Luxury (2WD) [CX8-LX]"  (EN DASH)
//   phu tung: "Loc dau dong co (Mazda CX-8 2.5 Luxury (2WD)) [CX8-LX]" (ngoac)
// nen backfill duoc chinh xac, khong phai nhap tay.
//
// Kiem chung trach so khop nhap nhang truoc khi viet buoc nay: 82 dich vu va
// 82 phu tung co ten doi xe, moi cai khop DUNG 1 doi (82 cap / 82 dong rieng).
// So con lai (58 dich vu, 53 phu tung) la loai DUNG CHUNG moi doi xe - dau
// dong co, dem xa dau, dau phanh... - de model_id NULL va VAN hien cho moi xe.
//
// LIKE va dau ngoac vuong: `[` mo mot lop ky tu trong LIKE cua SQL Server nen
// KHONG duoc dua duoi " [MA]" vao mau so khop - chi khop toi het display_name.

const STEPS = [
  ['Them cot services.model_id', `
    IF COL_LENGTH('dbo.services','model_id') IS NULL
      ALTER TABLE dbo.services ADD model_id BIGINT NULL;
  `],
  // EN DASH U+2013, khong phai gach ngang thuong - giong quy uoc dat ten o
  // ensureMaintenancePackageMeta.
  ['Backfill services.model_id theo ten dich vu', `
    UPDATE s SET model_id = vm.id
    FROM   dbo.services s
    JOIN   dbo.vehicle_models vm ON s.service_name LIKE N'%– ' + vm.display_name + N'%'
    WHERE  s.model_id IS NULL;
  `],
  ['Them khoa ngoai services -> vehicle_models', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE parent_object_id = OBJECT_ID('dbo.services')
                     AND referenced_object_id = OBJECT_ID('dbo.vehicle_models'))
      ALTER TABLE dbo.services
        ADD CONSTRAINT FK_services_vehicle_models
        FOREIGN KEY (model_id) REFERENCES dbo.vehicle_models(id);
  `],

  ['Them cot products.model_id', `
    IF COL_LENGTH('dbo.products','model_id') IS NULL
      ALTER TABLE dbo.products ADD model_id BIGINT NULL;
  `],
  ['Backfill products.model_id theo ten phu tung', `
    UPDATE p SET model_id = vm.id
    FROM   dbo.products p
    JOIN   dbo.vehicle_models vm ON p.product_name LIKE N'%(' + vm.display_name + N')%'
    WHERE  p.model_id IS NULL;
  `],
  ['Them khoa ngoai products -> vehicle_models', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE parent_object_id = OBJECT_ID('dbo.products')
                     AND referenced_object_id = OBJECT_ID('dbo.vehicle_models'))
      ALTER TABLE dbo.products
        ADD CONSTRAINT FK_products_vehicle_models
        FOREIGN KEY (model_id) REFERENCES dbo.vehicle_models(id);
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.services','model_id') IS NOT NULL
                  AND COL_LENGTH('dbo.products','model_id') IS NOT NULL
                 THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureCatalogModel() {
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
    err.message = `[gan doi xe cho catalog] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureCatalogModel, STEPS };
