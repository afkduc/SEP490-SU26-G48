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

test('getRepairOrderForExport rejects an invalid or missing repair order', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: { findRepairOrderForExport: async () => null },
  });

  await assert.rejects(
    () => service.getRepairOrderForExport(0),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => service.getRepairOrderForExport(9),
    (err) => err.statusCode === 404,
  );
});

test('lists export requests with normalized filters and pagination', async () => {
  let findFilters;
  const service = new ExportRequestService({ exportRequestRepository: {
    findAll: async (filters) => { findFilters = filters; return []; }, count: async () => 0,
  } });
  const result = await service.list({ branchId: '1', repairOrderId: '8', page: -1, limit: 999 });
  assert.deepEqual(result, { items: [], total: 0, page: 1, limit: 100 });
  // includeOpen = true vi dang tra cuu dich danh 1 RO.
  assert.deepEqual(findFilters, { branchId: 1, status: undefined, repairOrderId: 8, fromDate: undefined, toDate: undefined, search: undefined, includeOpen: true, page: 1, limit: 100 });
  await assert.rejects(() => service.list({}), (err) => err.statusCode === 400);
});

test('main export list only shows finished slips (RO already closed)', async () => {
  let findFilters;
  const service = new ExportRequestService({ exportRequestRepository: {
    findAll: async (filters) => { findFilters = filters; return []; }, count: async () => 0,
  } });
  await service.list({ branchId: 1 });
  assert.equal(findFilters.includeOpen, false);
});

test('gets export request detail and validates the id', async () => {
  const service = new ExportRequestService({ exportRequestRepository: {
    findById: async (id) => id === 1 ? { request: { id: 1, requestCode: 'ERB-1' }, items: [] } : null,
  } });
  assert.equal((await service.getById(1)).id, 1);
  await assert.rejects(() => service.getById(0), (err) => err.statusCode === 400);
  await assert.rejects(() => service.getById(2), (err) => err.statusCode === 404);
});

test('lists exportable repair orders for a warehouse branch', async () => {
  let listArgs;
  const service = new ExportRequestService({ exportRequestRepository: {
    findExportableRepairOrders: async (args) => { listArgs = args; return [{ id: 9 }]; },
    countExportableRepairOrders: async () => 1,
  } });
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

test('confirms a pickup in a transaction and never trusts client quantities', async () => {
  // FE chi gui productIds duoc tick - so luong do repository tu tinh lai.
  const calls = [];
  const repository = {
    confirmPickup: async (...args) => { calls.push(['confirmPickup', ...args]); return { request: { id: 1, requestCode: 'RO-2026-009', status: 'completed' }, items: [] }; },
  };
  const service = new ExportRequestService({ exportRequestRepository: repository });
  const result = await service.confirmPickup({
    branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21,
    receivedSignatureData: 'data:image/png;base64,abc123',
    productIds: [11, 12, 11],
  });
  assert.equal(result.status, 'completed');
  assert.equal(calls[0][0], 'confirmPickup');
  assert.equal(calls[0][1].id, 'tx-export');
  assert.equal(calls[0][2].repair_order_id, 9);
  assert.equal(calls[0][2].received_by, 21);
  assert.deepEqual(calls[0][2].product_ids, [11, 12]); // bo trung
  assert.equal(calls[0][2].signature_data, 'data:image/png;base64,abc123');
  assert.equal(calls[0][2].quantity, undefined); // khong nhan so luong tu FE
});

test('rejects pickup confirm when signature or ticked rows are missing', async () => {
  const service = new ExportRequestService({ exportRequestRepository: { confirmPickup: async () => { throw new Error('khong duoc goi'); } } });
  await assert.rejects(
    () => service.confirmPickup({ branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21, productIds: [11] }),
    (err) => err.statusCode === 400 && /ky xac nhan/.test(err.message),
  );
  await assert.rejects(
    () => service.confirmPickup({
      branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21,
      receivedSignatureData: 'data:image/png;base64,abc123', productIds: [],
    }),
    (err) => err.statusCode === 400 && /Chua chon dong/.test(err.message),
  );
});

test('getRepairOrderForExport no longer blocks an order that was already exported', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: {
      findRepairOrderForExport: async () => ({ id: 9, locked: false, exportRequestId: 5, items: [] }),
    },
  });
  const data = await service.getRepairOrderForExport(9);
  assert.equal(data.exportRequestId, 5);
  assert.equal(data.locked, false);
});
