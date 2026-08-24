const test = require('node:test');
const assert = require('node:assert/strict');
const transaction = require('../../src/utils/sqlTransaction');

// Mock transaction tai bien cua test de create() khong ket noi SQL Server.
transaction.runInTransaction = async (callback) => callback({ id: 'tx-export' });
const ExportRequestService = require('../../src/application/services/ExportRequestService');

test('list rejects a reversed date range', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: {
      findAll: async () => [],
      count: async () => 0,
    },
  });

  await assert.rejects(
    () => service.list({ branchId: 1, fromDate: '2026-08-05', toDate: '2026-08-01' }),
    (err) => err.statusCode === 400 && /Ngày bắt đầu/.test(err.message),
  );
});

test('getRepairOrderForExport rejects an order already exported', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: {
      findRepairOrderForExport: async () => ({ id: 9, alreadyExported: true }),
    },
  });

  await assert.rejects(
    () => service.getRepairOrderForExport(9),
    (err) => err.statusCode === 409 && /da duoc xuat kho/.test(err.message),
  );
});

test('lists export requests with normalized filters and pagination', async () => {
  let findFilters;
  const service = new ExportRequestService({ exportRequestRepository: {
    findAll: async (filters) => { findFilters = filters; return []; }, count: async () => 0,
  } });
  const result = await service.list({ branchId: '1', repairOrderId: '8', page: -1, limit: 999 });
  assert.deepEqual(result, { items: [], total: 0, page: 1, limit: 100 });
  assert.deepEqual(findFilters, { branchId: 1, status: undefined, repairOrderId: 8, fromDate: undefined, toDate: undefined, search: undefined, page: 1, limit: 100 });
  await assert.rejects(() => service.list({}), (err) => err.statusCode === 400);
});

test('gets export request detail and validates the id', async () => {
  const service = new ExportRequestService({ exportRequestRepository: {
    findById: async (id) => id === 1 ? { request: { id: 1, requestCode: 'ERB-1' }, items: [] } : null,
  } });
  assert.equal((await service.getById(1)).id, 1);
  await assert.rejects(() => service.getById(0), (err) => err.statusCode === 400);
  await assert.rejects(() => service.getById(2), (err) => err.statusCode === 404);
});

test('gets next code and exportable repair orders for a warehouse branch', async () => {
  let codeArgs;
  let listArgs;
  const service = new ExportRequestService({ exportRequestRepository: {
    getNextRequestCode: async (...args) => { codeArgs = args; return 'ERB-1-20260809-0001'; },
    findExportableRepairOrders: async (args) => { listArgs = args; return [{ id: 9 }]; },
    countExportableRepairOrders: async () => 1,
  } });
  assert.equal((await service.getNextRequestCode({ branchId: 1 })).requestCode, 'ERB-1-20260809-0001');
  assert.equal(codeArgs[0], 1);
  const result = await service.listExportableRepairOrders({ branchId: 1, search: 'RO', page: 0, limit: 200 });
  assert.deepEqual(result, { items: [{ id: 9 }], total: 1, page: 1, limit: 100 });
  assert.deepEqual(listArgs, { branchId: 1, search: 'RO', page: 1, limit: 100 });
});

test('gets an exportable repair order and rejects invalid or missing orders', async () => {
  const service = new ExportRequestService({ exportRequestRepository: { findRepairOrderForExport: async (id) => id === 1 ? { id: 1, alreadyExported: false } : null } });
  assert.equal((await service.getRepairOrderForExport(1)).id, 1);
  await assert.rejects(() => service.getRepairOrderForExport('x'), (err) => err.statusCode === 400);
  await assert.rejects(() => service.getRepairOrderForExport(2), (err) => err.statusCode === 404);
});

test('creates a completed export in a transaction', async () => {
  const calls = [];
  const repository = {
    getNextRequestCode: async (...args) => { calls.push(['code', ...args]); return 'ERB-1-20260809-0001'; },
    create: async (...args) => { calls.push(['create', ...args]); return { request: { id: 1, requestCode: 'ERB-1-20260809-0001', status: 'completed' }, items: [] }; },
  };
  const service = new ExportRequestService({ exportRequestRepository: repository });
  const result = await service.create({ branchId: 1, repairOrderId: 9, performedBy: 7, items: [{ productId: 11, productCode: 'PT-11', productName: 'Loc dau', quantity: 2 }] });
  assert.equal(result.status, 'completed');
  assert.equal(calls[0][0], 'code');
  assert.equal(calls[1][1].id, 'tx-export');
  assert.equal(calls[1][2].request_code, 'ERB-1-20260809-0001');
});
