const { sql } = require('../database/sqlServer');

// Hang muc bi khach huy giua chung (xem RepairSettlementService.js) van duoc
// giu lai trong danh sach task "mong muon" (khong xoa dong nua) - danh dau
// isCancelled=true de to truong/tho van thay dau muc do (gach ngang, ghi
// "(Khach huy)") thay vi bien mat khoi checklist. Van dam bao khong the huy 1
// dau muc DA tick hoan thanh boi validation truoc khi luu - xem
// RepairSettlementRepositoryImpl.wouldLoseCompletedTasks.
const CANCELLED_HTTT = 'HUY';

function itemTypeFor(lhsc) {
  return lhsc === 'PT' ? 'product' : 'service';
}

// Pure - khong dung DB, de dung lai duoc ca cho validate (tren payload FE gui
// len, chua luu DB) lan cho dong bo task that (tren du lieu da luu). items:
// mang da chuan hoa { lhsc, serviceId, itemCode, description, productId,
// quantity, unitPrice, httt }. packageServiceNamesByCode: Map<package_code,
// [{ serviceId, serviceName }]> - danh sach dich vu con THAT cua tung goi
// (tra tu catalog, xem loadPackageServiceNames).
//
// Mot dong "goi dich vu" la 1 dong duy nhat, khong co serviceId (chi dich vu
// le duoc chon rieng moi co serviceId), luu ma goi trong itemCode. Tach dong
// nay thanh N task con (1 task / 1 dich vu le trong goi) de to truong tick
// tung dau muc rieng. Dong dich vu le nam trong 1 goi vua duoc no task o tren
// (FE tu chen them de hien thi chi tiet gia 0d) se bi bo qua, tranh trung dau
// muc voi to truong.
function computeDesiredTasks(items, packageServiceNamesByCode) {
  const tasks = [];
  const coveredServiceIds = new Set();

  for (const item of items) {
    const itemType = itemTypeFor(item.lhsc);
    const isPackageRow = itemType === 'service' && !item.serviceId;
    const isCancelled = item.httt === CANCELLED_HTTT;

    // Dau goi combo khong bao gio co task rieng cho chinh no (task luon sinh
    // theo tung dich vu con) - neu ca goi bi huy, cac dong dich vu con (da
    // duoc FE lat httt='HUY' theo, xem handleCancelItem) se tu tao task huy
    // rieng o nhanh ben duoi, khong can khai trien qua catalog nua.
    if (isCancelled) {
      if (isPackageRow) continue;
      tasks.push({
        taskName: item.description,
        taskType: itemType,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isCancelled: true,
        note: item.note || null,
      });
      continue;
    }

    if (isPackageRow) {
      const pkgServices = packageServiceNamesByCode.get(item.itemCode) || [];
      if (pkgServices.length > 0) {
        for (const svc of pkgServices) {
          coveredServiceIds.add(String(svc.serviceId));
          tasks.push({ taskName: svc.serviceName, taskType: 'service', productId: null, quantity: 1, unitPrice: 0 });
        }
        continue;
      }
      // Khong tim thay goi (du lieu la, hiem) -> roi xuong tao 1 task gom
      // chung nhu cu de khong mat viec.
    }

    if (item.serviceId && coveredServiceIds.has(String(item.serviceId))) {
      continue;
    }

    tasks.push({
      taskName: item.description,
      taskType: itemType,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      note: item.note || null,
    });
  }

  return tasks;
}

// Tra ve Map<package_code, [{ serviceId, serviceName }]> cho danh sach ma goi
// can tra - dung chung cho buildDesiredTasks (trong transaction) lan validate
// truoc khi luu (ngoai transaction, tren payload FE). queryPackageServices la
// 1 ham (packageCode) => Promise<rows tho tu DB> - de caller tu quyet dinh
// chay qua tx.request() hay qua query() thuong, khong ep 1 kieu ket noi.
async function loadPackageServiceNames(queryPackageServices, packageCodes) {
  const map = new Map();
  for (const code of packageCodes) {
    const rows = await queryPackageServices(code);
    map.set(code, rows.map((r) => ({ serviceId: r.service_id, serviceName: r.service_name })));
  }
  return map;
}

const PACKAGE_SERVICES_SQL = `
  SELECT s.id AS service_id, s.service_name
  FROM   service_packages sp
  JOIN   service_package_items spi ON spi.package_id = sp.id
  JOIN   services s ON s.id = spi.service_id
  WHERE  sp.package_code = @code
  ORDER  BY s.service_name
`;

function packageCodesNeeding(items) {
  return [...new Set(
    items.filter((it) => itemTypeFor(it.lhsc) === 'service' && !it.serviceId).map((it) => it.itemCode)
  )];
}

// Dung chung cho luc TAO lenh sua chua (no het items -> tasks lan dau) va luc
// co van CHINH SUA phieu quyet toan da gan to truong (dong bo lai checklist).
async function buildDesiredTasks(tx, repairOrderId) {
  const itemsResult = await tx
    .request()
    .input('repairOrderId', sql.BigInt, repairOrderId)
    .query(`SELECT * FROM repair_order_items WHERE repair_order_id = @repairOrderId ORDER BY id`);

  const items = itemsResult.recordset.map((r) => ({
    lhsc: r.lhsc,
    serviceId: r.service_id,
    itemCode: r.item_code,
    description: r.item_description,
    productId: r.product_id,
    quantity: r.quantity,
    unitPrice: r.unit_price,
    httt: r.httt,
    note: r.note,
  }));

  const packageServiceNamesByCode = await loadPackageServiceNames(
    (code) => tx.request().input('code', sql.VarChar(30), code).query(PACKAGE_SERVICES_SQL).then((r) => r.recordset),
    packageCodesNeeding(items)
  );

  return computeDesiredTasks(items, packageServiceNamesByCode);
}

module.exports = {
  buildDesiredTasks,
  computeDesiredTasks,
  loadPackageServiceNames,
  packageCodesNeeding,
  PACKAGE_SERVICES_SQL,
  itemTypeFor,
  CANCELLED_HTTT,
};
