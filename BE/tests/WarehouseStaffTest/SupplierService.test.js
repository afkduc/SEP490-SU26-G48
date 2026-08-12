const test = require('node:test');
const assert = require('node:assert/strict');
const SupplierService = require('../../src/application/services/SupplierService');

const supplier = { id: 1, supplierCode: 'SUP-01', supplierName: 'NCC A', contactName: 'An', phone: '0901', email: 'a@example.com', address: 'HN', taxCode: '123', status: 'active', internalNote: 'hidden' };

test('lists warehouse suppliers with filters and only public fields', async () => {
  let filters;
  const service = new SupplierService({ supplierRepository: { findAll: async (f) => { filters = f; return [supplier]; } } });
  const result = await service.getSuppliers({ search: 'NCC', status: 'active' });
  assert.deepEqual(filters, { search: 'NCC', status: 'active' });
  assert.equal(result.total, 1); assert.equal(result.items[0].internalNote, undefined);
});

test('gets supplier detail and reports a missing supplier', async () => {
  const service = new SupplierService({ supplierRepository: { findById: async (id) => id === 1 ? supplier : null } });
  assert.equal((await service.getSupplierById(1)).taxCode, '123');
  await assert.rejects(() => service.getSupplierById(2), (err) => err.status === 404);
});
