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

module.exports = { getPool, query, sql };
