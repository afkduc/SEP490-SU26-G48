const sql = require('mssql');
const { getPool } = require('./sqlServer');

// BO BANG `brands`. AutoGara chi con nhan Mazda nen bang nay chi con 1 dong
// that (MAZDA) + 1 dong rac test (SSA/"ssa", is_active=0). Moi cot brand_id
// deu tro ve cung 1 hang:
//   vehicles        18/18 dong  -> brand_id = 1
//   vehicle_models  55/55 dong  -> brand_id = 1
//   service_requests 10 dong    -> vehicle_brand_id = 1 (6 dong NULL)
//
// KHONG co gi phai chuyen di dau truoc khi bo:
//  - warranty_years / warranty_km tren brands la DU LIEU CHET: khong trigger,
//    khong default, khong doan code nao tinh warranty_end_date tu chung. Han
//    bao hanh that nam san theo tung xe o warranty_records (warranty_end_date
//    + warranty_km). Da doi chieu ky truoc khi bo.
//  - brand_name chi dung de ghep chuoi hien thi ten xe, ma ghep xong lai ra
//    "Mazda Mazda CX-5 2.0 Premium 2023" vi vehicle_model_text VON DA chua
//    chu "Mazda" - bo di la het lap (xem RepairSettlementRepositoryImpl).
//
// LUU Y: `products.brand_name` la HANG PHU TUNG (Bosch, Denso, Motul...) -
// khai niem hoan toan khac, KHONG dinh dang gi toi bang nay.
//
// Cot `service_requests.vehicle_brand_other` duoc GIU LAI: no chua du lieu
// lich su that (co 1 yeu cau khach ghi "Lambogini") ma khong cho nao khac co.
// Form tren Landing khong con hoi hang xe nua nen cot nay chi con y nghia luu
// tru; muon bo han thi phai chap nhan mat dong do.

const STEPS = [
  ['Bo khoa ngoai vehicles -> brands', `
    DECLARE @fk SYSNAME = (SELECT TOP 1 fk.name FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('dbo.vehicles')
        AND fk.referenced_object_id = OBJECT_ID('dbo.brands'));
    IF @fk IS NOT NULL EXEC('ALTER TABLE dbo.vehicles DROP CONSTRAINT [' + @fk + ']');
  `],
  ['Bo cot vehicles.brand_id', `
    IF COL_LENGTH('dbo.vehicles','brand_id') IS NOT NULL
      ALTER TABLE dbo.vehicles DROP COLUMN brand_id;
  `],

  ['Bo khoa ngoai vehicle_models -> brands', `
    DECLARE @fk SYSNAME = (SELECT TOP 1 fk.name FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('dbo.vehicle_models')
        AND fk.referenced_object_id = OBJECT_ID('dbo.brands'));
    IF @fk IS NOT NULL EXEC('ALTER TABLE dbo.vehicle_models DROP CONSTRAINT [' + @fk + ']');
  `],
  ['Bo cot vehicle_models.brand_id', `
    IF COL_LENGTH('dbo.vehicle_models','brand_id') IS NOT NULL
      ALTER TABLE dbo.vehicle_models DROP COLUMN brand_id;
  `],

  ['Bo khoa ngoai service_requests -> brands', `
    DECLARE @fk SYSNAME = (SELECT TOP 1 fk.name FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('dbo.service_requests')
        AND fk.referenced_object_id = OBJECT_ID('dbo.brands'));
    IF @fk IS NOT NULL EXEC('ALTER TABLE dbo.service_requests DROP CONSTRAINT [' + @fk + ']');
  `],
  ['Bo cot service_requests.vehicle_brand_id', `
    IF COL_LENGTH('dbo.service_requests','vehicle_brand_id') IS NOT NULL
      ALTER TABLE dbo.service_requests DROP COLUMN vehicle_brand_id;
  `],

  ['Bo bang brands', `
    IF OBJECT_ID('dbo.brands','U') IS NOT NULL DROP TABLE dbo.brands;
  `],
];

async function alreadyDropped(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN OBJECT_ID('dbo.brands','U') IS NULL THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureDropBrands() {
  const pool = await getPool();
  if (await alreadyDropped(pool)) return { skipped: true, steps: 0 };

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
    err.message = `[bo bang brands] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureDropBrands };
