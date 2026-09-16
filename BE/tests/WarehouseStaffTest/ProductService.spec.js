const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const ProductService = require('../../src/application/services/ProductService');

const product = (overrides = {}) => ({
  id: 1, productCode: 'PT-001', productName: 'Lọc dầu Toyota Vios',
  category: 'Phụ tùng động cơ', unitId: 1, unitName: 'Cái', unitPrice: 150000,
  stockQuantity: 5, minStock: 2, supplierId: 2, supplierName: 'Nhà cung cấp An Phát',
  branchId: 3, status: 'active', ...overrides,
});

const makeService = (productRepository = {}) => new ProductService({ productRepository });
const expectError = (action, statusCode, message) => assert.rejects(
  action,
  (error) => error.statusCode === statusCode && error.message === message,
);

test('returns the filtered warehouse parts list', async () => {
  let received;
  const service = makeService({
    findAll: async (filters) => { received = filters; return [product()]; },
    count: async () => 1,
  });
  const filters = { branchId: 3, search: 'Lọc dầu', status: 'active', category: 'Phụ tùng động cơ', lowStockOnly: false, page: 1, limit: 20 };
  const result = await service.getAllProducts(filters);
  assert.deepEqual(received, filters);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].productCode, 'PT-001');
  assert.equal(result.items[0].productName, 'Lọc dầu Toyota Vios');
});

test('returns an empty warehouse parts list when no part matches', async () => {
  const result = await makeService({ findAll: async () => [], count: async () => 0 })
    .getAllProducts({ branchId: 3, search: 'không có', page: 1, limit: 20 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('returns part details for an existing id', async () => {
  const result = await makeService({ findById: async () => product() }).getProductById(1);
  assert.equal(result.id, 1);
  assert.equal(result.productCode, 'PT-001');
  assert.equal(result.unitPrice, 150000);
});

test('reports a missing part id', async () => {
  const service = makeService({ findById: async () => null });
  await expectError(() => service.getProductById(999), 404, 'Không tìm thấy phụ tùng');
});

test('creates a part from all fields shown on the form', async () => {
  let created;
  const service = makeService({ findByCode: async () => null, create: async (payload) => { created = payload; return product(payload); } });
  const result = await service.createProduct({
    productCode: 'PT-001', productName: 'Lọc dầu Toyota Vios', category: 'Phụ tùng động cơ',
    unitId: 1, unitPrice: 150000, minStock: 5, supplierId: 2, branchId: 3,
    status: 'active', note: 'Dùng cho Toyota Vios',
  });
  assert.equal(created.productName, 'Lọc dầu Toyota Vios');
  assert.equal(created.unitPrice, 150000);
  assert.equal(result.productCode, 'PT-001');
  assert.equal(result.status, 'active');
});

test('requires a part name when creating a part', async () => {
  const service = makeService();
  await expectError(() => service.createProduct({ productCode: 'PT-001', branchId: 3, unitId: 1 }), 400, 'Tên phụ tùng không được để trống');
});

test('requires a part code when creating a part', async () => {
  const service = makeService();
  await expectError(() => service.createProduct({ productName: 'Lọc dầu Toyota Vios', branchId: 3, unitId: 1 }), 400, 'Mã phụ tùng không được để trống');
});

test('requires a branch when creating a part', async () => {
  const service = makeService();
  await expectError(() => service.createProduct({ productCode: 'PT-001', productName: 'Lọc dầu Toyota Vios', unitId: 1 }), 400, 'Vui lòng chọn chi nhánh');
});

test('requires a unit when creating a part', async () => {
  const service = makeService();
  await expectError(() => service.createProduct({ productCode: 'PT-001', productName: 'Lọc dầu Toyota Vios', branchId: 3 }), 400, 'Vui lòng chọn đơn vị');
});

test('rejects a duplicate part code in the selected branch', async () => {
  const service = makeService({ findByCode: async () => product() });
  await expectError(() => service.createProduct({ productCode: 'PT-001', productName: 'Lọc dầu Toyota Vios', branchId: 3, unitId: 1 }), 409, 'Mã phụ tùng đã tồn tại trong chi nhánh');
});

test('updates the editable part fields', async () => {
  let updated;
  const service = makeService({
    findById: async () => product(), findByCode: async () => null,
    update: async (_id, payload) => { updated = payload; return product(payload); },
  });
  const result = await service.updateProduct(1, {
    productName: 'Lọc dầu Toyota Vios mới', category: 'Phụ tùng động cơ', unitId: 1,
    unitPrice: 175000, minStock: 4, supplierId: 2, status: 'active',
    note: 'Đã cập nhật', stockQuantity: 999,
  });
  assert.equal(updated.stockQuantity, undefined);
  assert.equal(result.productName, 'Lọc dầu Toyota Vios mới');
  assert.equal(result.unitPrice, 175000);
});

test('reports a missing part when updating', async () => {
  const service = makeService({ findById: async () => null });
  await expectError(() => service.updateProduct(999, { productName: 'Tên mới' }), 404, 'Không tìm thấy phụ tùng');
});

test('rejects a duplicate part code when updating', async () => {
  const service = makeService({ findById: async () => product(), findByCode: async () => product({ id: 2, productCode: 'PT-002' }) });
  await expectError(() => service.updateProduct(1, { productCode: 'PT-002' }), 409, 'Mã phụ tùng đã tồn tại trong chi nhánh');
});

test('deactivates an existing part', async () => {
  const result = await makeService({ delete: async () => product({ status: 'inactive' }) }).deleteProduct(1);
  assert.equal(result.id, 1);
  assert.equal(result.status, 'inactive');
});

test('reports a missing part when deactivating', async () => {
  const service = makeService({ delete: async () => null });
  await expectError(() => service.deleteProduct(999), 404, 'Không tìm thấy phụ tùng');
});

test('reactivates an existing part', async () => {
  const result = await makeService({ reactivate: async () => product({ status: 'active' }) }).reactivateProduct(1);
  assert.equal(result.id, 1);
  assert.equal(result.status, 'active');
});

test('reports a missing part when reactivating', async () => {
  const service = makeService({ reactivate: async () => null });
  await expectError(() => service.reactivateProduct(999), 404, 'Không tìm thấy phụ tùng');
});


test('stock history: running balance walks backward from current stock (import/return +, export -)', async () => {
  const service = makeService({
    findById: async () => product({ id: 7, stockQuantity: 49 }),
    findStockHistory: async (id) => {
      assert.equal(id, 7);
      return [
        { id: 1, type: 'import', quantity: 50, slipCode: 'IRB-1', happenedAt: '2026-09-05T00:00:00.000Z' },
        { id: 2, type: 'export', quantity: 4, slipCode: 'RO-2026-127', happenedAt: '2026-09-10T10:15:00.000Z' },
        { id: 3, type: 'return', quantity: 3, slipCode: 'RO-2026-127', happenedAt: '2026-09-11T08:00:00.000Z' },
      ];
    },
  });
  const h = await service.getStockHistory(7);
  assert.equal(h.currentStock, 49);
  // 49 - (+50 -4 +3) = 0 ton dau ky
  assert.equal(h.openingStock, 0);
  assert.deepEqual(h.events.map((e) => [e.delta, e.balanceAfter]), [[50, 50], [-4, 46], [3, 49]]);
  assert.equal(h.events[1].happenedAtLabel, '10/09/2026 10:15');
  assert.equal(h.events[0].happenedAtLabel, '05/09/2026 00:00');
});

test('stock history rejects unknown product', async () => {
  const service = makeService({ findById: async () => null });
  await assert.rejects(() => service.getStockHistory(99), (err) => err.statusCode === 404);
});
