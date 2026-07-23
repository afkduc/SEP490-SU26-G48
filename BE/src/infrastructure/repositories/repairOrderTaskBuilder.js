const { sql } = require('../database/sqlServer');

// Dung chung cho luc TAO lenh sua chua (no het items -> tasks lan dau) va luc
// co van CHINH SUA phieu quyet toan da gan to truong (dong bo lai checklist).
// Mot dong "goi dich vu" trong service_order_items la 1 dong duy nhat, khong
// co service_id (chi dich vu le duoc chon rieng moi co service_id), va luu ma
// goi trong item_code. Tach dong nay thanh N task con (1 task / 1 dich vu le
// trong goi) de to truong tick tung dau muc rieng. Dong dich vu le nam trong
// 1 goi vua duoc no task o tren (FE tu chen them de hien thi chi tiet gia 0d)
// se bi bo qua, tranh trung dau muc voi to truong.
async function buildDesiredTasks(tx, serviceOrderId) {
  const itemsResult = await tx
    .request()
    .input('serviceOrderId', sql.BigInt, serviceOrderId)
    .query(`SELECT * FROM service_order_items WHERE service_order_id = @serviceOrderId ORDER BY id`);

  const tasks = [];
  const coveredServiceIds = new Set();

  for (const item of itemsResult.recordset) {
    const isPackageRow = item.item_type === 'service' && !item.service_id;

    if (isPackageRow) {
      const pkgServicesResult = await tx
        .request()
        .input('code', sql.VarChar(30), item.item_code)
        .query(`
          SELECT s.id AS service_id, s.service_name
          FROM   service_packages sp
          JOIN   service_package_items spi ON spi.package_id = sp.id
          JOIN   services s ON s.id = spi.service_id
          WHERE  sp.package_code = @code
          ORDER  BY s.service_name
        `);

      if (pkgServicesResult.recordset.length > 0) {
        for (const svc of pkgServicesResult.recordset) {
          coveredServiceIds.add(String(svc.service_id));
          tasks.push({ taskName: svc.service_name, taskType: 'service', productId: null, quantity: 1, unitPrice: 0 });
        }
        continue;
      }
      // Khong tim thay goi (du lieu la, hiem) -> roi xuong tao 1 task gom
      // chung nhu cu de khong mat viec.
    }

    if (item.service_id && coveredServiceIds.has(String(item.service_id))) {
      continue;
    }

    tasks.push({
      taskName: item.item_description,
      taskType: item.item_type,
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    });
  }

  return tasks;
}

module.exports = { buildDesiredTasks };
