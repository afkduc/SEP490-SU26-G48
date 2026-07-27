/**
 * Chay nhieu cau SQL trong 1 transaction.
 * Dung cho cac thao tac kho (nhap/xuat/dieu chinh) can dam bao
 * tat ca thanh cong HOAC tat ca rollback.
 *
 * Cach dung:
 *   const { runInTransaction } = require('../utils/sqlTransaction');
 *   await runInTransaction(async (tx) => {
 *     await tx.request().input('id', sql.BigInt, id)
 *       .query('UPDATE parts SET stock_quantity = stock_quantity + @delta WHERE id = @id');
 *     await tx.request().input('code', sql.VarChar, code)
 *       .query('INSERT INTO inventory_transactions ...');
 *   });
 */
const { getPool } = require('../infrastructure/database/sqlServer');

async function runInTransaction(work) {
  const pool = await getPool();
  const transaction = pool.transaction();
  try {
    await transaction.begin();
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('[sqlTransaction] rollback failed:', rollbackErr.message);
    }
    throw err;
  }
}

module.exports = { runInTransaction };
