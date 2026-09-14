const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const InventoryService = require('../../src/application/services/InventoryService');

const item = (overrides = {}) => ({ id: 1, productCode: 'PT-001', productName: 'Lọc dầu', stockQuantity: 2, minStock: 3, branchId: 1, ...overrides });
const makeService = (inventoryRepository = {}) => new InventoryService({ inventoryRepository });

test('returns stock matching the branch filters', async () => {
  let received;
  const service = makeService({
    getStockByBranch: async (branchId, filters) => { received = [branchId, filters]; return [item()]; },
    countStockByBranch: async () => 1,
  });
  const result = await service.getStockList({ branchId: 1, search: 'lọc dầu', category: 'Động cơ', page: 1, limit: 20 });
  assert.deepEqual(received, [1, { search: 'lọc dầu', category: 'Động cơ', lowStockOnly: undefined, page: 1, limit: 20 }]);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].isLowStock, true);
  assert.equal(result.items[0].stockGap, -1);
});

test('returns an empty stock list when no part matches', async () => {
  const service = makeService({ getStockByBranch: async () => [], countStockByBranch: async () => 0 });
  const result = await service.getStockList({ branchId: 1, search: 'không có', page: 1, limit: 20 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('requires a branch when listing stock', async () => {
  await assert.rejects(() => makeService().getStockList(), (error) => error.statusCode === 400 && error.message === 'Tài khoản chưa được gán chi nhánh');
});

test('returns the low-stock parts for a branch', async () => {
  const result = await makeService({ getLowStock: async () => [item()] }).getLowStockList(1);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].productCode, 'PT-001');
  assert.equal(result.items[0].isLowStock, true);
});

test('requires a branch when listing low-stock parts', async () => {
  await assert.rejects(() => makeService().getLowStockList(), (error) => error.statusCode === 400);
});

test('returns stock details for an existing part', async () => {
  const result = await makeService({ getStockByProduct: async () => item() }).getStockDetail(1, 1);
  assert.equal(result.productCode, 'PT-001');
  assert.equal(result.stockQuantity, 2);
});

test('reports a part missing from the selected branch', async () => {
  const service = makeService({ getStockByProduct: async () => null });
  await assert.rejects(() => service.getStockDetail(999, 1), (error) => error.statusCode === 404 && error.message === 'Không tìm thấy phụ tùng trong chi nhánh');
});

test('returns the stock summary for a branch', async () => {
  const summary = [{ productCount: 2, totalQuantity: 7, totalValue: 1200000 }];
  const result = await makeService({ getStockSummaryByCategory: async () => summary }).getStockSummary(1);
  assert.deepEqual(result, { summary, totalProducts: 2, totalQuantity: 7, totalValue: 1200000 });
});

test('requires a branch when reading the stock summary', async () => {
  await assert.rejects(() => makeService().getStockSummary(), (error) => error.statusCode === 400);
});

test('adjusts stock with a valid quantity', async () => {
  let received;
  const service = makeService({ adjustStock: async (...args) => { received = args; return item({ stockQuantity: 4 }); } });
  const result = await service.adjustStock(1, 1, 2, { reason: 'Kiểm kê' });
  assert.deepEqual(received, [1, 1, 2, { reason: 'Kiểm kê' }]);
  assert.equal(result.stockQuantity, 4);
});

test('rejects a nonnumeric stock adjustment', async () => {
  await assert.rejects(() => makeService().adjustStock(1, 1, Number.NaN), (error) => error.statusCode === 400);
});

test('searches active parts without Vietnamese accents', async () => {
  const products = [item({ productName: 'Lọc dầu' }), item({ id: 2, productCode: 'LOC-002', productName: 'Khác' })];
  const result = await makeService({ findAllActiveProducts: async () => products }).searchProducts('loc', 1);
  assert.equal(result.length, 2);
  assert.equal(result[0].productName, 'Lọc dầu');
});

test('requires at least two characters when searching parts', async () => {
  await assert.rejects(() => makeService().searchProducts('l', 1), (error) => error.statusCode === 400);
});

test('returns top-used parts for the selected period', async () => {
  let received;
  const service = makeService({ getTopUsedPartsStats: async (...args) => { received = args; return [{ productId: 1, productName: 'Lọc dầu' }]; } });
  const result = await service.getTopUsedPartsStats({ branchId: 1, fromDate: '2026-09-01', toDate: '2026-09-11', limit: 10 });
  assert.deepEqual(received, [1, { fromDate: '2026-09-01', toDate: '2026-09-11', limit: 10 }]);
  assert.equal(result[0].productName, 'Lọc dầu');
});

test('requires a branch when reading top-used parts', async () => {
  await assert.rejects(() => makeService().getTopUsedPartsStats(), (error) => error.statusCode === 400);
});
