const test = require('node:test');
const assert = require('node:assert/strict');
const ProductService = require('../../src/application/services/ProductService');

const product = (overrides = {}) => ({
  id: 1, productCode: 'PT-01', productName: 'Loc dau', category: 'Engine',
  unitId: 1, unit: 'Cai', stockQuantity: 5, minStock: 2, branchId: 3,
  status: 'active', ...overrides,
});

test('lists warehouse parts with normalized pagination and DTO fields', async () => {
  const calls = [];
  const service = new ProductService({ productRepository: {
    findAll: async (filters) => { calls.push(filters); return [product()]; },
    count: async (filters) => { calls.push(filters); return 1; },
  } });
  const result = await service.getAllProducts({ branchId: 3, page: '0', limit: 'x', lowStockOnly: true });
  assert.equal(result.total, 1);
  assert.equal(result.page, 1);
  assert.equal(result.limit, 20);
  assert.equal(result.items[0].isLowStock, false);
  assert.deepEqual(calls[0], { branchId: 3, status: undefined, search: undefined, category: undefined, lowStockOnly: true, page: '0', limit: 'x' });
});

test('gets a part by id and rejects a missing part', async () => {
  const repository = { findById: async (id) => id === 1 ? product() : null };
  const service = new ProductService({ productRepository: repository });
  assert.equal((await service.getProductById(1)).productCode, 'PT-01');
  await assert.rejects(() => service.getProductById(2), (err) => err.statusCode === 404);
});

test('creates a part after validation, uniqueness check, and strips stock fields', async () => {
  let created;
  const service = new ProductService({ productRepository: {
    findByCode: async () => null,
    create: async (payload) => { created = payload; return product(payload); },
  } });
  const result = await service.createProduct({ productName: 'Loc dau', productCode: 'PT-02', branchId: 3, unitId: 1, stockQuantity: 999, stock_quantity: 999 });
  assert.equal(created.stockQuantity, undefined);
  assert.equal(created.stock_quantity, undefined);
  assert.equal(result.stockQuantity, 5);
});

test('rejects invalid or duplicate part creation', async () => {
  const repo = { findByCode: async () => product(), create: async () => product() };
  const service = new ProductService({ productRepository: repo });
  await assert.rejects(() => service.createProduct({}), (err) => err.statusCode === 400);
  await assert.rejects(() => service.createProduct({ productName: 'A', productCode: 'PT-01', branchId: 3, unitId: 1 }), (err) => err.statusCode === 409);
});

test('updates parts safely and protects stock from direct updates', async () => {
  let updated;
  const service = new ProductService({ productRepository: {
    findById: async () => product(), findByCode: async () => null,
    update: async (_id, payload) => { updated = payload; return product(payload); },
  } });
  const result = await service.updateProduct(1, { productName: 'Moi', stockQuantity: 100 });
  assert.equal(updated.stockQuantity, undefined);
  assert.equal(result.productName, 'Moi');
});

test('rejects updates for missing parts or duplicate codes', async () => {
  let found = product();
  const service = new ProductService({ productRepository: {
    findById: async () => found,
    findByCode: async () => product({ id: 2 }),
  } });
  await assert.rejects(() => service.updateProduct(1, { productCode: 'PT-02' }), (err) => err.statusCode === 409);
  found = null;
  await assert.rejects(() => service.updateProduct(1, {}), (err) => err.statusCode === 404);
});

test('deactivates, reactivates, and lists warehouse part metadata', async () => {
  const service = new ProductService({ productRepository: {
    delete: async () => product({ status: 'inactive' }), reactivate: async () => product(),
    getDistinctCategories: async () => ['Engine'], listUnits: async () => [{ id: 1, unitName: 'Cai' }],
  } });
  assert.equal((await service.deleteProduct(1)).status, 'inactive');
  assert.equal((await service.reactivateProduct(1)).status, 'active');
  assert.deepEqual(await service.getCategories(), ['Engine']);
  assert.equal((await service.listUnits())[0].unitName, 'Cai');
});
