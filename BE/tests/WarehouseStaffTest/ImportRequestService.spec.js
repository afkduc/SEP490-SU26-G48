const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const ImportRequestService = require('../../src/application/services/ImportRequestService');

const payload = (overrides = {}) => ({
  branchId: 1, supplierId: 2, supplierInvoiceNo: 'HD-2026-001', requestedBy: 7,
  notes: 'Nhập phụ tùng tháng 9',
  items: [{ productId: 11, productCode: 'PT-001', productName: 'Lọc dầu', unit: 'Cái', quantity: 3 }],
  ...overrides,
});

const detail = (id = 101, status = 'approved') => ({
  request: {
    id, requestCode: 'PN-2026-001', branchId: 1, supplierId: 2,
    supplierName: 'Nhà cung cấp An Phát', supplierInvoiceNo: 'HD-2026-001',
    requestedBy: 7, requestedByName: 'Nguyễn Văn Kho', approvedBy: status === 'approved' ? 7 : null,
    approvedByName: status === 'approved' ? 'Nguyễn Văn Kho' : null,
    importDate: '2026-09-11', status, notes: 'Nhập phụ tùng tháng 9', createdAt: '2026-09-11T08:00:00.000Z',
  },
  items: [{ id: 1, importRequestId: id, productId: 11, productCode: 'PT-001', productName: 'Lọc dầu', unit: 'Cái', quantity: 3 }],
});

function repository(overrides = {}) {
  return {
    findAll: async () => [], count: async () => 0,
    existsBySupplierInvoice: async () => false,
    getNextRequestCode: async () => 'PN-2026-001',
    create: async () => 101,
    approve: async () => ({ ok: true }),
    findById: async (id) => detail(id),
    ...overrides,
  };
}

const makeService = (repo, transactionRunner = async (callback) => callback({ id: 'tx-import' })) => new ImportRequestService({ importRequestRepository: repo, transactionRunner });
const expectError = (action, statusCode, message) => assert.rejects(action, (error) => error.statusCode === statusCode && error.message === message);

test('returns import requests matching the visible filters', async () => {
  let received;
  const row = detail(1).request;
  const service = makeService(repository({
    findAll: async (filters) => { received = filters; return [row]; },
    count: async () => 1,
  }));
  const result = await service.list({ branchId: 1, status: 'approved', supplierId: 2, fromDate: '2026-09-01', toDate: '2026-09-11', search: 'PN-2026', page: 1, limit: 20 });
  assert.deepEqual(received, { branchId: 1, status: 'approved', supplierId: 2, fromDate: new Date('2026-09-01'), toDate: new Date('2026-09-11'), search: 'PN-2026', page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].requestCode, 'PN-2026-001');
});

test('returns the import request used by the Excel list case', async () => {
  let received;
  const row = { ...detail(7, 'pending').request, requestCode: 'IRB-1' };
  const service = makeService(repository({
    findAll: async (filters) => { received = filters; return [row]; },
    count: async () => 1,
  }));
  const result = await service.list({ branchId: 1, search: 'IRB', status: 'pending', fromDate: '2026-09-01', toDate: '2026-09-10', page: 1, limit: 20 });
  assert.equal(received.search, 'IRB');
  assert.equal(received.status, 'pending');
  assert.deepEqual(received.fromDate, new Date('2026-09-01'));
  assert.deepEqual(received.toDate, new Date('2026-09-10'));
  assert.equal(result.items[0].id, 7);
  assert.equal(result.items[0].requestCode, 'IRB-1');
});

test('returns an empty import-request list when no keyword matches', async () => {
  const service = makeService(repository({ findAll: async () => [], count: async () => 0 }));
  const result = await service.list({ branchId: 1, search: 'không có', page: 1, limit: 20 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('rejects an import-request end date before its start date', async () => {
  const service = makeService(repository());
  await assert.rejects(() => service.list({ branchId: 1, fromDate: '2026-09-11', toDate: '2026-09-01' }), (error) => error.statusCode === 400);
});

test('returns import-request details for an existing id', async () => {
  const result = await makeService(repository()).getById(101, { branchId: 1 });
  assert.equal(result.id, 101);
  assert.equal(result.requestCode, 'PN-2026-001');
  assert.equal(result.supplierInvoiceNo, 'HD-2026-001');
  assert.equal(result.items[0].quantity, 3);
});

test('returns the pending import request used by the Excel detail case', async () => {
  const repo = repository({ findById: async () => ({ ...detail(7, 'pending'), request: { ...detail(7, 'pending').request, requestCode: 'IRB-1' } }) });
  const result = await makeService(repo).getById(7, { branchId: 1 });
  assert.equal(result.id, 7);
  assert.equal(result.requestCode, 'IRB-1');
  assert.equal(result.status, 'pending');
});

test('reports a missing import-request id', async () => {
  const service = makeService(repository({ findById: async () => null }));
  await expectError(() => service.getById(999, { branchId: 1 }), 404, 'Không tìm thấy phiếu nhập');
});

test('creates and completes an import request from the form fields', async () => {
  let created;
  let approved;
  const repo = repository({
    create: async (_tx, requestData, items) => { created = { requestData, items }; return 101; },
    approve: async (_tx, id, approvedBy, importDate, options) => { approved = { id, approvedBy, importDate, options }; return true; },
  });
  const result = await makeService(repo).create(payload(), { autoApprove: true, approvedBy: 7 });
  assert.equal(created.requestData.supplier_invoice_no, 'HD-2026-001');
  assert.equal(created.items[0].product_name, 'Lọc dầu');
  assert.equal(created.items[0].quantity, 3);
  assert.equal(approved.approvedBy, 7);
  assert.equal(result.status, 'approved');
  assert.equal(result.requestCode, 'PN-2026-001');
});

test('requires the supplier invoice number when creating an import request', async () => {
  const service = makeService(repository());
  await expectError(() => service.create(payload({ supplierInvoiceNo: '' }), { autoApprove: true, approvedBy: 7 }), 400, 'Số hóa đơn nhà cung cấp không được để trống');
});

test('requires at least one part when creating an import request', async () => {
  const service = makeService(repository());
  await expectError(() => service.create(payload({ items: [] }), { autoApprove: true, approvedBy: 7 }), 400, 'Phiếu nhập phải có ít nhất 1 phụ tùng');
});

test('requires a positive integer quantity when creating an import request', async () => {
  const service = makeService(repository());
  await expectError(() => service.create(payload({ items: [{ productId: 11, productCode: 'PT-001', productName: 'Lọc dầu', unit: 'Cái', quantity: 0 }] }), { autoApprove: true, approvedBy: 7 }), 400, 'Dòng 1: số lượng phải là số nguyên dương');
});

test('rejects a duplicate supplier invoice number', async () => {
  const service = makeService(repository({ existsBySupplierInvoice: async () => true }));
  await assert.rejects(() => service.create(payload(), { autoApprove: true, approvedBy: 7 }), (error) => error.statusCode === 409 && error.message.includes('đã được nhập'));
});
