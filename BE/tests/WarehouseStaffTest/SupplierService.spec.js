const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const SupplierService = require('../../src/application/services/SupplierService');

const supplier = {
  id: 1, supplierCode: 'NCC-001', supplierName: 'Nhà cung cấp An Phát',
  contactName: 'Nguyễn Văn An', phone: '0901234567', email: 'anphat@example.com',
  address: 'Hà Nội', taxCode: '0101234567', status: 'active', internalNote: 'Không trả về giao diện',
};

test('returns suppliers matching the keyword and status', async () => {
  let received;
  const service = new SupplierService({ supplierRepository: { findAll: async (filters) => { received = filters; return [supplier]; } } });
  const result = await service.getSuppliers({ search: 'An Phát', status: 'active' });
  assert.deepEqual(received, { search: 'An Phát', status: 'active' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].supplierName, 'Nhà cung cấp An Phát');
  assert.equal(result.items[0].internalNote, undefined);
});

test('returns an empty supplier list when no supplier matches', async () => {
  const service = new SupplierService({ supplierRepository: { findAll: async () => [] } });
  const result = await service.getSuppliers({ search: 'không có', status: 'active' });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('returns supplier details for an existing id', async () => {
  const service = new SupplierService({ supplierRepository: { findById: async () => supplier } });
  const result = await service.getSupplierById(1);
  assert.equal(result.id, 1);
  assert.equal(result.supplierCode, 'NCC-001');
  assert.equal(result.taxCode, '0101234567');
});

test('reports a missing supplier id', async () => {
  const service = new SupplierService({ supplierRepository: { findById: async () => null } });
  await assert.rejects(() => service.getSupplierById(999), (error) => error.status === 404 && error.message === 'Không tìm thấy nhà cung cấp');
});
