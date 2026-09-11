const sql = require('mssql');
const { getPool } = require('./sqlServer');

// BO 4 COT CHET cua `vehicle_models`: body_type, engine_displacement,
// drivetrain, model_code.
//
// Da ra soat toan bo BE + FE + Landing truoc khi bo:
//  - model_code: KHONG nam trong bat ky cau SELECT nao, khong doc o dau ca.
//  - body_type / engine_displacement / drivetrain: chi duoc map ra DTO trong
//    VehicleModelRepository roi khong FE nao dung toi.
//
// `segment` KHONG bo - da tung bo roi phai them lai. Day la cot duy nhat trong
// nhom co y nghia nghiep vu that: no la nguon phan khuc xe chuan cho so do than
// xe o phieu kiem tra nhan xe. Hien man hinh do van tu DOAN bang cach parse
// chuoi ten xe (detectSegmentFromModelText trong IntakeChecklistSection.jsx) -
// phai doan vi CVDV co the go tay khong chon tu catalog, khi do model_id = NULL
// - nhung khi da chon tu catalog thi doc thang cot nay se dung hon.
//
// Constraint `vehicle_models_uq` cu phu (model_line, generation_code,
// trim_name, engine_displacement, drivetrain) nen phai go truoc khi bo cot,
// roi dung lai tren 3 cot con lai - van du de chan trung ban trang bi.
//
// Neu sau nay lam goi y phu tung theo doi xe (dau nhot theo dung tich, loc
// gio theo doi may) thi them lai cot va nap du lieu tu catalog Mazda.

const STEPS = [
  ['Kiem tra trung lap tren 3 cot con lai', `
    IF EXISTS (
      SELECT 1 FROM dbo.vehicle_models
      GROUP BY model_line, generation_code, trim_name
      HAVING COUNT(*) > 1
    )
      THROW 50001, 'Co dong trung (model_line, generation_code, trim_name) - don trung truoc da', 1;
  `],
  ['Bo unique constraint cu', `
    IF EXISTS (SELECT 1 FROM sys.key_constraints
               WHERE name = 'vehicle_models_uq' AND parent_object_id = OBJECT_ID('dbo.vehicle_models'))
      ALTER TABLE dbo.vehicle_models DROP CONSTRAINT vehicle_models_uq;
  `],
  ['Bo 4 cot khong dung', `
    DECLARE @drop NVARCHAR(MAX) = '';
    SELECT @drop = STUFF((
      SELECT ', ' + QUOTENAME(name) FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.vehicle_models')
        AND name IN ('body_type', 'engine_displacement', 'drivetrain', 'model_code')
      FOR XML PATH('')), 1, 2, '');
    IF @drop IS NOT NULL
      EXEC('ALTER TABLE dbo.vehicle_models DROP COLUMN ' + @drop);
  `],
  ['Dung lai unique constraint tren 3 cot', `
    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints
                   WHERE name = 'vehicle_models_uq' AND parent_object_id = OBJECT_ID('dbo.vehicle_models'))
      ALTER TABLE dbo.vehicle_models
        ADD CONSTRAINT vehicle_models_uq UNIQUE (model_line, generation_code, trim_name);
  `],
];

async function alreadyTrimmed(pool) {
  const r = await pool.request().query(`
    SELECT COUNT(*) AS con_lai FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.vehicle_models')
      AND name IN ('body_type', 'engine_displacement', 'drivetrain', 'model_code')`);
  return r.recordset[0].con_lai === 0;
}

async function ensureTrimVehicleModelColumns() {
  const pool = await getPool();
  if (await alreadyTrimmed(pool)) return { skipped: true, steps: 0 };

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
    err.message = `[bo cot chet vehicle_models] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureTrimVehicleModelColumns };
