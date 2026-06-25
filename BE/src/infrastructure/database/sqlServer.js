const sql = require('mssql');
const config = require('../../config');

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config.db);
  console.log('Connected to SQL Server:', config.db.database);
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
