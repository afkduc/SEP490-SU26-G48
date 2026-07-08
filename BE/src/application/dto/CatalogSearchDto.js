function toServiceDto(row) {
  return {
    id: row.id,
    code: row.service_code,
    name: row.service_name,
    categoryId: row.category_id,
    unitPrice: row.unit_price,
  };
}

// Gop cac dong (package_id, service_id) phang tu JOIN thanh mang goi
// dich vu, moi goi kem theo danh sach hang muc con cua no.
function groupPackageRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.package_id)) {
      map.set(row.package_id, {
        id: row.package_id,
        code: row.package_code,
        name: row.package_name,
        categoryId: row.category_id,
        applicableKm: row.applicable_km,
        totalPrice: row.total_price,
        items: [],
      });
    }
    map.get(row.package_id).items.push({
      serviceId: row.service_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      unitPrice: row.unit_price,
    });
  }
  return Array.from(map.values());
}

module.exports = { toServiceDto, groupPackageRows };
