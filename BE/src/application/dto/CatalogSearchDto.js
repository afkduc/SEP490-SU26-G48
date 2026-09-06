function toPartDto(row) {
  return {
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    unitPrice: row.product_unit_price,
    unitName: row.unit_name,
    quantity: row.quantity,
    stockQuantity: row.stock_quantity,
  };
}

// Gop cac dong service_parts thanh map service_id -> mang phu tung (dinh
// muc/BOM) cua dich vu do, de gan vao tung dich vu/hang muc trong goi.
function groupPartsByServiceId(partRows) {
  const map = new Map();
  for (const row of partRows) {
    if (!map.has(row.service_id)) map.set(row.service_id, []);
    map.get(row.service_id).push(toPartDto(row));
  }
  return map;
}

function toServiceDto(row, partsByServiceId = new Map()) {
  return {
    id: row.id,
    code: row.service_code,
    name: row.service_name,
    categoryId: row.category_id,
    unitPrice: row.unit_price,
    repairCategory: row.repair_category,
    parts: partsByServiceId.get(row.id) || [],
  };
}

// Gop cac dong (package_id, service_id) phang tu JOIN thanh mang goi
// dich vu, moi goi kem theo danh sach hang muc con cua no (kem dinh muc phu
// tung rieng cua tung hang muc, de FE auto-fill khi chon ca goi). repairCategory
// cua GOI (khai bao rieng, khong suy tu dich vu con) dung de FE tu dien LHSC
// cho ca nhom (dong goi + dong dich vu con + phu tung) khi chon 1 goi combo.
function groupPackageRows(rows, partsByServiceId = new Map()) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.package_id)) {
      map.set(row.package_id, {
        id: row.package_id,
        code: row.package_code,
        name: row.package_name,
        categoryId: row.category_id,
        totalPrice: row.total_price,
        repairCategory: row.package_repair_category,
        // Doi xe ma goi nay danh cho (service_packages.model_id) - FE loc theo
        // xe dang bao duong de khong con chon nham goi cua doi xe khac.
        modelId: row.model_id ?? null,
        items: [],
      });
    }
    map.get(row.package_id).items.push({
      serviceId: row.service_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      unitPrice: row.unit_price,
      repairCategory: row.service_repair_category,
      // Bieu mau BDDK: yeu cau thuc hien (I/R/M/V) + nhom cong viec.
      actionCode: row.action_code ?? null,
      checklistGroup: row.checklist_group ?? null,
      checklistOrder: row.checklist_order ?? null,
      parts: partsByServiceId.get(row.service_id) || [],
    });
  }
  return Array.from(map.values());
}

module.exports = { toServiceDto, groupPackageRows, groupPartsByServiceId };
