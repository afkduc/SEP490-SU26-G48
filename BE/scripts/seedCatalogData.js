/**
 * Seed du lieu catalog (dich vu le, goi combo, phu tung) cho MOI chi nhanh -
 * gia dao dong 3.000-10.000d de de test luong thanh toan (PayOS QR so tien
 * nho). Dong thoi don dep ten phu tung dang gan cung 1 mau xe cu the (vd "Dau
 * Mazda CX2") ve ten chung chung (vd "Dau").
 *
 * Chay o BE/ (can .env that de ket noi dung DB):
 *   node scripts/seedCatalogData.js            -> CHI XEM TRUOC (khong ghi DB)
 *   node scripts/seedCatalogData.js --apply     -> ghi that vao DB
 *
 * An toan/idempotent:
 *   - Khong tao trung: bo qua dich vu/goi/phu tung da co san TEN giong het
 *     (khong phan biet hoa/thuong) trong cung chi nhanh.
 *   - Doi ten phu tung LUON in ra bang doi chieu truoc, CHI ghi that khi co
 *     --apply - tranh doi nham do token khop sai (token lay tu chinh du lieu
 *     that: brands.brand_name + tu dau tien cua vehicles.vehicle_model_text,
 *     khong doan mo hinh xe).
 */
require('../src/config/env');
const { query, getPool } = require('../src/infrastructure/database/sqlServer');

const APPLY = process.argv.includes('--apply');

// ---- Du lieu mau se them (moi chi nhanh) ------------------------------

const PRODUCTS = [
  { name: 'Dầu phanh', unit: 'Chai', price: 6200 },
  { name: 'Dầu động cơ', unit: 'Lít', price: 9500 },
  { name: 'Mỡ bôi trơn', unit: 'Hộp', price: 4800 },
  { name: 'Nước làm mát', unit: 'Chai', price: 7300 },
  { name: 'Nước rửa kính', unit: 'Chai', price: 3900 },
  { name: 'Bugi', unit: 'Cái', price: 8500 },
  { name: 'Cầu chì', unit: 'Cái', price: 3200 },
  { name: 'Gioăng cao su', unit: 'Cái', price: 5100 },
  { name: 'Đai ốc bánh xe', unit: 'Cái', price: 3600 },
  { name: 'Bóng đèn pha', unit: 'Cái', price: 9800 },
  { name: 'Bóng đèn xi-nhan', unit: 'Cái', price: 4200 },
  { name: 'Lưỡi gạt mưa', unit: 'Cái', price: 7900 },
  { name: 'Kẹp ống dẫn nhiên liệu', unit: 'Cái', price: 3400 },
  { name: 'Lọc dầu', unit: 'Cái', price: 8900 },
  { name: 'Lọc gió động cơ', unit: 'Cái', price: 9200 },
  { name: 'Băng keo cách điện', unit: 'Cuộn', price: 3100 },
  { name: 'Keo dán kính', unit: 'Hộp', price: 6700 },
  { name: 'Bộ ốc vít đa năng', unit: 'Bộ', price: 8200 },
];

const SERVICES = [
  { name: 'Kiểm tra hệ thống phanh', repairCategory: 'PM', price: 5000 },
  { name: 'Kiểm tra áp suất lốp', repairCategory: 'PM', price: 3000 },
  { name: 'Vệ sinh lọc gió', repairCategory: 'PM', price: 6500 },
  { name: 'Tra dầu bản lề cửa', repairCategory: 'CB', price: 3500 },
  { name: 'Kiểm tra đèn chiếu sáng', repairCategory: 'EE', price: 4000 },
  { name: 'Xiết lại ốc gầm', repairCategory: 'CB', price: 5500 },
  { name: 'Vệ sinh khoang máy', repairCategory: 'ER', price: 9000 },
  { name: 'Bơm mỡ khớp nối', repairCategory: 'CB', price: 4500 },
  { name: 'Kiểm tra ắc quy', repairCategory: 'EE', price: 3800 },
  { name: 'Đánh bóng đèn pha', repairCategory: 'BP', price: 8000 },
];

// serviceNames tham chieu dung TEN trong SERVICES o tren - script tu tra ra
// id sau khi tao/tim thay dich vu tuong ung.
const PACKAGES = [
  {
    name: 'Gói kiểm tra nhanh',
    repairCategory: 'PM',
    price: 7500,
    serviceNames: ['Kiểm tra hệ thống phanh', 'Kiểm tra áp suất lốp'],
  },
  {
    name: 'Gói chăm sóc cơ bản',
    repairCategory: 'PM',
    price: 9000,
    serviceNames: ['Vệ sinh lọc gió', 'Tra dầu bản lề cửa'],
  },
  {
    name: 'Gói kiểm tra điện',
    repairCategory: 'EE',
    price: 6800,
    serviceNames: ['Kiểm tra đèn chiếu sáng', 'Kiểm tra ắc quy'],
  },
];

const DEFAULT_CATEGORY_NAMES = ['Bảo dưỡng', 'Sửa chữa'];

// ---- Helpers ------------------------------------------------------------

async function nextCode(table, column, prefix) {
  const result = await query(
    `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(${column}, @prefixLen, 10) AS INT)), 0) + 1 AS next_num
     FROM ${table} WHERE ${column} LIKE @likePattern`,
    { prefixLen: prefix.length + 1, likePattern: `${prefix}%` }
  );
  return result.recordset[0].next_num;
}

async function ensureCategories() {
  const existing = await query(`SELECT id, category_name FROM service_categories`);
  if (existing.recordset.length > 0) return existing.recordset.map((r) => r.id);

  const ids = [];
  for (const name of DEFAULT_CATEGORY_NAMES) {
    const result = await query(
      `INSERT INTO service_categories (category_name) OUTPUT INSERTED.id VALUES (@name)`,
      { name }
    );
    ids.push(result.recordset[0].id);
  }
  return ids;
}

async function getOrCreateUnitId(unitName, fallbackUnitId) {
  const found = await query(`SELECT TOP 1 id FROM units WHERE unit_name = @name`, { name: unitName });
  if (found.recordset.length) return found.recordset[0].id;
  try {
    const created = await query(
      `INSERT INTO units (unit_name) OUTPUT INSERTED.id VALUES (@name)`,
      { name: unitName }
    );
    return created.recordset[0].id ?? fallbackUnitId;
  } catch (err) {
    // Bang units co the co cot NOT NULL khac chua biet truoc - khong de sap
    // ca script chi vi 1 don vi tinh moi, dung tam don vi mac dinh.
    console.warn(`  [cảnh báo] Không tạo được đơn vị tính "${unitName}" (${err.message}) - dùng đơn vị mặc định thay thế.`);
    return fallbackUnitId;
  }
}

// ---- Seed 1 chi nhanh -----------------------------------------------------

async function seedBranch(branch, categoryIds) {
  console.log(`\n=== Chi nhánh: ${branch.name} (${branch.code}) ===`);

  const existingProducts = await query(
    `SELECT product_name FROM products WHERE branch_id = @branchId`,
    { branchId: branch.id }
  );
  const existingProductNames = new Set(existingProducts.recordset.map((r) => r.product_name.trim().toLowerCase()));

  const existingServices = await query(
    `SELECT id, service_name FROM services WHERE branch_id = @branchId`,
    { branchId: branch.id }
  );
  const serviceIdByName = new Map(existingServices.recordset.map((r) => [r.service_name.trim().toLowerCase(), r.id]));

  const existingPackages = await query(
    `SELECT package_name FROM service_packages WHERE branch_id = @branchId`,
    { branchId: branch.id }
  );
  const existingPackageNames = new Set(existingPackages.recordset.map((r) => r.package_name.trim().toLowerCase()));

  let productNum = await nextCode('products', 'product_code', `PT-${branch.code}-`);
  let serviceNum = await nextCode('services', 'service_code', `DV-${branch.code}-`);
  let packageNum = await nextCode('service_packages', 'package_code', `GOI-${branch.code}-`);
  let catIdx = 0;
  const nextCategoryId = () => categoryIds[(catIdx++) % categoryIds.length];

  // -- Phu tung --
  for (const p of PRODUCTS) {
    if (existingProductNames.has(p.name.trim().toLowerCase())) {
      console.log(`  [bỏ qua - đã có] Phụ tùng: ${p.name}`);
      continue;
    }
    const code = `PT-${branch.code}-${String(productNum).padStart(3, '0')}`;
    productNum += 1;
    if (!APPLY) {
      console.log(`  [sẽ thêm] Phụ tùng ${code}: ${p.name} (${p.unit}) - ${p.price.toLocaleString('vi-VN')}đ`);
      continue;
    }
    const unitId = await getOrCreateUnitId(p.unit, 1);
    await query(
      `INSERT INTO products (product_code, product_name, unit_id, unit_price, stock_quantity, min_stock, branch_id, status)
       VALUES (@code, @name, @unitId, @price, @stock, @minStock, @branchId, 'active')`,
      { code, name: p.name, unitId, price: p.price, stock: 50, minStock: 5, branchId: branch.id }
    );
    console.log(`  [đã thêm] Phụ tùng ${code}: ${p.name} (${p.unit}) - ${p.price.toLocaleString('vi-VN')}đ`);
  }

  // -- Dich vu le --
  for (const s of SERVICES) {
    const key = s.name.trim().toLowerCase();
    if (serviceIdByName.has(key)) {
      console.log(`  [bỏ qua - đã có] Dịch vụ: ${s.name}`);
      continue;
    }
    const code = `DV-${branch.code}-${String(serviceNum).padStart(3, '0')}`;
    serviceNum += 1;
    if (!APPLY) {
      console.log(`  [sẽ thêm] Dịch vụ ${code}: ${s.name} - ${s.price.toLocaleString('vi-VN')}đ`);
      continue;
    }
    const result = await query(
      `INSERT INTO services (service_code, service_name, category_id, unit_price, duration_min, description, is_active, branch_id, repair_category)
       OUTPUT INSERTED.id
       VALUES (@code, @name, @categoryId, @price, @durationMin, @description, 1, @branchId, @repairCategory)`,
      // duration_min/description khong dung toi trong bo du lieu mau nay -
      // truyen 0/'' thay vi null de tranh mssql khong suy ra duoc kieu du
      // lieu cho tham so null "tran" qua helper query() chung (khong ep
      // kieu), an toan hon la giai phap phai kiem chung lai voi DB that.
      { code, name: s.name, categoryId: nextCategoryId(), price: s.price, durationMin: 0, description: '', branchId: branch.id, repairCategory: s.repairCategory }
    );
    serviceIdByName.set(key, result.recordset[0].id);
    console.log(`  [đã thêm] Dịch vụ ${code}: ${s.name} - ${s.price.toLocaleString('vi-VN')}đ`);
  }

  // -- Goi combo --
  for (const pkg of PACKAGES) {
    if (existingPackageNames.has(pkg.name.trim().toLowerCase())) {
      console.log(`  [bỏ qua - đã có] Gói combo: ${pkg.name}`);
      continue;
    }
    const serviceIds = pkg.serviceNames.map((n) => serviceIdByName.get(n.trim().toLowerCase())).filter(Boolean);
    if (serviceIds.length !== pkg.serviceNames.length) {
      console.log(`  [bỏ qua - thiếu dịch vụ con] Gói combo: ${pkg.name}`);
      continue;
    }
    const code = `GOI-${branch.code}-${String(packageNum).padStart(3, '0')}`;
    packageNum += 1;
    if (!APPLY) {
      console.log(`  [sẽ thêm] Gói combo ${code}: ${pkg.name} (${pkg.serviceNames.join(' + ')}) - ${pkg.price.toLocaleString('vi-VN')}đ`);
      continue;
    }
    const result = await query(
      `INSERT INTO service_packages (package_code, package_name, category_id, total_price, description, purpose, is_active, branch_id, repair_category)
       OUTPUT INSERTED.id
       VALUES (@code, @name, @categoryId, @price, @description, @purpose, 1, @branchId, @repairCategory)`,
      { code, name: pkg.name, categoryId: nextCategoryId(), price: pkg.price, description: '', purpose: '', branchId: branch.id, repairCategory: pkg.repairCategory }
    );
    const packageId = result.recordset[0].id;
    for (const serviceId of serviceIds) {
      await query(
        `INSERT INTO service_package_items (package_id, service_id) VALUES (@packageId, @serviceId)`,
        { packageId, serviceId }
      );
    }
    console.log(`  [đã thêm] Gói combo ${code}: ${pkg.name} (${pkg.serviceNames.join(' + ')}) - ${pkg.price.toLocaleString('vi-VN')}đ`);
  }
}

// ---- Don ten phu tung gan cung mau xe cu the ------------------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Don dep khoang trang/dau "/" mo coi sau khi da xoa token o giua ten (vd
// "Bộ má phanh trước  /" sau khi xoa "Mazda" va "CX-5" -> "Bộ má phanh trước").
function normalizeName(str) {
  let s = str;
  s = s.replace(/\s\/|\/\s/g, ' '); // "/" ke khoang trang (1 phia da bi xoa token) -> coi nhu khoang trang
  s = s.replace(/^\/+|\/+$/g, ''); // "/" con sot o dau/cuoi chuoi
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function cleanupVehicleSpecificProductNames() {
  console.log(`\n=== Rà tên phụ tùng gắn cứng theo mẫu xe cụ thể ===`);

  const brandsResult = await query(`SELECT DISTINCT brand_name FROM brands WHERE brand_name IS NOT NULL AND brand_name <> ''`);
  const vehiclesResult = await query(`SELECT DISTINCT vehicle_model_text FROM vehicles WHERE vehicle_model_text IS NOT NULL AND vehicle_model_text <> ''`);

  // Token = ten hang xe THAT (brands.brand_name) + TU DAU TIEN cua
  // vehicle_model_text (thuong la ten dong xe, vd "K3 1.6 Deluxe 2024" ->
  // "K3"; "CX-5 2.0 Luxury 2024" -> "CX-5") - lay tu du lieu THAT trong DB,
  // khong doan ten mau xe.
  const tokens = new Set();
  brandsResult.recordset.forEach((r) => tokens.add(r.brand_name.trim()));
  vehiclesResult.recordset.forEach((r) => {
    const firstWord = r.vehicle_model_text.trim().split(/\s+/)[0];
    if (firstWord && firstWord.length >= 2) tokens.add(firstWord);
  });

  if (tokens.size === 0) {
    console.log('  Không có hãng xe/mẫu xe nào trong DB để đối chiếu - bỏ qua bước này.');
    return;
  }

  const productsResult = await query(`SELECT id, product_name, branch_id FROM products`);
  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length); // token dai truoc, tranh cat nham 1 phan cua token dai hon

  const changes = [];
  for (const row of productsResult.recordset) {
    let cleaned = row.product_name;
    let matched = false;
    for (const token of sortedTokens) {
      // Bien la khoang trang, dau "/", hoac dau/cuoi chuoi - cho phep ghep
      // toi 2 chu so ngay sau token khong co khoang trang (vd model ghep nhu
      // "Mazda3") de bat luon truong hop nay. Dung lookbehind/lookahead
      // (khong "an" ky tu bien) de giu nguyen dau phan cach con lai, xu ly
      // don khoang trang/dau "/" mo coi rieng o normalizeName.
      const re = new RegExp(`(?<=^|[\\s/])${escapeRegex(token)}\\d{0,2}(?=[\\s/]|$)`, 'gi');
      if (re.test(cleaned)) {
        cleaned = cleaned.replace(re, '');
        matched = true;
      }
    }
    if (!matched) continue;
    cleaned = normalizeName(cleaned);
    if (!cleaned) continue; // ten rong sau khi bo token -> qua la, khong dong y sua tu dong, bo qua
    if (cleaned === row.product_name.trim()) continue;
    changes.push({ id: row.id, branchId: row.branch_id, oldName: row.product_name, newName: cleaned });
  }

  if (changes.length === 0) {
    console.log('  Không tìm thấy phụ tùng nào có tên gắn cứng theo mẫu xe.');
    return;
  }

  console.log(`  Tìm thấy ${changes.length} phụ tùng cần đổi tên:`);
  for (const c of changes) {
    console.log(`   - [#${c.id}] "${c.oldName}"  ->  "${c.newName}"`);
  }

  if (!APPLY) {
    console.log('  (Chỉ xem trước - chạy lại kèm --apply để ghi thật.)');
    return;
  }

  for (const c of changes) {
    await query(`UPDATE products SET product_name = @name WHERE id = @id`, { id: c.id, name: c.newName });
  }
  console.log(`  Đã cập nhật ${changes.length} tên phụ tùng.`);
}

// ---- Main -----------------------------------------------------------------

async function main() {
  console.log(APPLY ? 'CHE DO GHI THAT (--apply)' : 'CHE DO XEM TRUOC (thêm --apply để ghi thật vào DB)');

  const branchesResult = await query(`SELECT id, branch_code, branch_name FROM branches ORDER BY id`);
  const branches = branchesResult.recordset.map((r) => ({ id: r.id, code: r.branch_code, name: r.branch_name }));
  if (branches.length === 0) {
    console.log('Không tìm thấy chi nhánh nào trong DB.');
  } else {
    const categoryIds = await ensureCategories();
    for (const branch of branches) {
      await seedBranch(branch, categoryIds);
    }
  }

  await cleanupVehicleSpecificProductNames();

  console.log('\nHoàn tất.');
}

main()
  .catch((err) => {
    console.error('Lỗi:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = await getPool().catch(() => null);
    if (pool) await pool.close();
  });
