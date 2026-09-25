const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Truoc day vehicles.license_plate luu ca 2 kieu trinh bay cho CUNG 1 dinh
// dang bien so ("30A-123.45" co dau cham VA "30A-12345" khong dau cham deu
// qua duoc validate) -> tra/tao xe theo bien so so sanh CHUOI Y HET nen 2
// cach go khac nhau cua CUNG 1 bien so ngoai doi bi coi la 2 xe khac nhau,
// co the tao trung xe/khach hang. Da sua tan goc o code (xem normalizeBienSo
// trong utils/fieldValidation.js - dung CHUNG o moi noi tao/tim xe theo bien
// so tu gio), migration nay chi CHUAN HOA lai du lieu CU cho khop voi quy tac
// moi: xoa dau "." khoi cac bien so da luu san (thuan tuy trinh bay, khong
// mat thong tin). Da kiem truoc khi viet: 32 xe hien co, xoa dau "." KHONG
// gay trung khoa voi index unique vehicles_plate_uq.
const STEPS = [
  ['Xoa dau "." khoi vehicles.license_plate (chi la cach trinh bay)', `
    UPDATE dbo.vehicles
    SET license_plate = REPLACE(license_plate, '.', '')
    WHERE license_plate LIKE '%.%';
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.vehicles WHERE license_plate LIKE '%.%') THEN 0 ELSE 1 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureVehiclePlateNormalized() {
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
    err.message = `[chuan hoa bien so xe - xoa dau cham] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureVehiclePlateNormalized, STEPS };
