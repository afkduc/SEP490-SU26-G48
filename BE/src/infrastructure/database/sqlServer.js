const sql = require('mssql');
const config = require('../../config');

let pool = null;

async function getPool() {
  if (pool) return pool;
  // options.useUTC = true: bat buoc driver msnodesqlv8 tra ve Date object
  // o UTC thay vi local time. Rat quan trong cho cac cot datetime luu UTC.
  pool = await sql.connect({
    ...config.db,
    options: {
      ...(config.db.options || {}),
      useUTC: true,
    },
  });
  console.log('Connected to SQL Server:', config.db.database, '(useUTC=true)');
  return pool;
}

async function query(queryStr, params = {}) {
  const conn = await getPool();
  const request = conn.request();
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
  return request.query(queryStr);
}

/**
 * Chay mot callback trong transaction (BEGIN/COMMIT/ROLLBACK).
 * Callback nhan mot `txQuery(queryStr, params)` de chay query trong transaction do.
 * Neu callback throw -> ROLLBACK tu dong; neu OK -> COMMIT.
 *
 * Ly do: can atomicity cho bulk operations (vd: setRolePermissionsMatrix —
 * cap nhat nhieu role trong 1 transaction de tranh partial-fail state).
 */
async function executeTransaction(callback) {
  const conn = await getPool();
  const tx = conn.transaction();
  await tx.begin();

  const txQuery = async (queryStr, params = {}) => {
    const request = tx.request();
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    return request.query(queryStr);
  };

  try {
    const result = await callback(txQuery);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* ignore rollback errors */ }
    throw err;
  }
}

module.exports = { getPool, query, sql, executeTransaction };
