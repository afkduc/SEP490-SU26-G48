const test = require('node:test');
const assert = require('node:assert/strict');
const InventoryService = require('../../src/application/services/InventoryService');

const item = (overrides = {}) => ({ id: 1, productCode: 'PT-01', productName: 'Loc dau', stockQuantity: 2, minStock: 3, branchId: 1, ...overrides });

test('lists stock with bounded pagination and mapped stock indicators', async () => {
  const calls = [];
  const service = new InventoryService({ inventoryRepository: {
    getStockByBranch: async (...args) => { calls.push(args); return [item()]; }, countStockByBranch: async () => 1,
  } });
  const result = await service.getStockList({ branchId: 1, page: 0, limit: 500, search: 'loc' });
  assert.equal(result.page, 1); assert.equal(result.limit, 100); assert.equal(result.items[0].isLowStock, true); assert.equal(result.items[0].stockGap, -1);
  assert.deepEqual(calls[0], [1, { search: 'loc', category: undefined, lowStockOnly: undefined, page: 1, limit: 100 }]);
});

test('requires branch id for stock list, low-stock, summary, and top-used parts', async () => {
  const service = new InventoryService({ inventoryRepository: {} });
  for (const action of [() => service.getStockList(), () => service.getLowStockList(), () => service.getStockSummary(), () => service.getTopUsedPartsStats()]) {
    await assert.rejects(action, (err) => err.statusCode === 400);
  }
});

test('returns low stock, details, and aggregate summary', async () => {
  const service = new InventoryService({ inventoryRepository: {
    getLowStock: async () => [item()], getStockByProduct: async () => item(),
    getStockSummaryByCategory: async () => [{ productCount: 2, totalQuantity: 7, totalValue: 120 }],
  } });
  assert.equal((await service.getLowStockList(1)).total, 1);
  assert.equal((await service.getStockDetail(1, 1)).productCode, 'PT-01');
  assert.deepEqual(await service.getStockSummary(1), { summary: [{ productCount: 2, totalQuantity: 7, totalValue: 120 }], totalProducts: 2, totalQuantity: 7, totalValue: 120 });
});

test('validates stock detail and adjustment, returning repository results', async () => {
  let adjustment;
  const service = new InventoryService({ inventoryRepository: {
    getStockByProduct: async () => null,
    adjustStock: async (...args) => { adjustment = args; return item({ stockQuantity: 4 }); },
  } });
  await assert.rejects(() => service.getStockDetail(1, 1), (err) => err.statusCode === 404);
  await assert.rejects(() => service.adjustStock(1, 1, NaN), (err) => err.statusCode === 400);
  assert.equal((await service.adjustStock(1, 1, 2, { reason: 'count' })).stockQuantity, 4);
  assert.deepEqual(adjustment, [1, 1, 2, { reason: 'count' }]);
});

test('searches active warehouse parts without Vietnamese accents and limits results', async () => {
  const products = [item({ productName: 'Lọc dầu' }), item({ id: 2, productCode: 'LOC-2', productName: 'Khac' })];
  const service = new InventoryService({ inventoryRepository: { findAllActiveProducts: async () => products } });
  const result = await service.searchProducts('loc', 1);
  assert.equal(result.length, 2);
  await assert.rejects(() => service.searchProducts('l', 1), (err) => err.statusCode === 400);
});

test('returns top used parts statistics with warehouse filters', async () => {
  let received;
  const service = new InventoryService({ inventoryRepository: { getTopUsedPartsStats: async (...args) => { received = args; return [{ productId: 1 }]; } } });
  assert.deepEqual(await service.getTopUsedPartsStats({ branchId: 1, limit: 5 }), [{ productId: 1 }]);
  assert.deepEqual(received, [1, { fromDate: undefined, toDate: undefined, limit: 5 }]);
});
