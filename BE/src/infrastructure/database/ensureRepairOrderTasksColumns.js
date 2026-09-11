const { getPool } = require('./sqlServer');

// prev_quantity: so luong TRUOC lan doi gan nhat (NULL = chua tung doi) - dung
// de tinh chenh lech khi CVDV sua phieu tang/giam so luong 1 dau muc, xem
// RepairSettlementRepositoryImpl._syncRepairOrderTasks va FE TaskNameLabel
// ("Khách thêm số lượng"/"Khách trả lại SL xN").
// note: ghi chu rieng cho dau muc (vd luu y cua khach cho tho) - CVDV nhap
// tren phieu quyet toan (repair_order_items.note), dong bo sang day de man
// Khoang xe/Landing cua to truong/tho cung thay duoc.
async function ensureRepairOrderTasksColumns() {
  const pool = await getPool();
  await pool.request().query(`
    IF COL_LENGTH('dbo.repair_order_tasks', 'prev_quantity') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD prev_quantity INT NULL;

    IF COL_LENGTH('dbo.repair_order_tasks', 'note') IS NULL
      ALTER TABLE dbo.repair_order_tasks ADD note NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.repair_order_items', 'note') IS NULL
      ALTER TABLE dbo.repair_order_items ADD note NVARCHAR(500) NULL;
  `);
}

module.exports = { ensureRepairOrderTasksColumns };
