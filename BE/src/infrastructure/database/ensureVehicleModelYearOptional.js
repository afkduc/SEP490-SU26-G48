const sql = require('mssql');
const { getPool } = require('./sqlServer');

// vehicle_models.year_from/year_to chi la ghi chu "doi xe san xuat tu nam nao
// den nam nao" - KHONG co logic nao dung (khong loc goi bao duong, khong loc
// phu tung, khong hien thi). year_from dang NOT NULL nen form them dong xe
// bat nguoi dung phai dien 1 con so vo nghia -> noi thanh NULL, bo khoi form.
// Giu cot (khong DROP) de 12 dong cu van con ghi chu tham khao.

const STEPS = [
  ['Noi vehicle_models.year_from thanh NULL', `
    ALTER TABLE dbo.vehicle_models ALTER COLUMN year_from INT NULL;
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS done
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'vehicle_models' AND COLUMN_NAME = 'year_from'`
  );
  return r.recordset[0]?.done === 1;
}

async function ensureVehicleModelYearOptional() {
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
    err.message = `[nam san xuat dong xe] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureVehicleModelYearOptional, STEPS };
