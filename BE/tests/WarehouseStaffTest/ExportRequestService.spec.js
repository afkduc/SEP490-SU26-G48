const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const transaction = require('../../src/utils/sqlTransaction');

transaction.runInTransaction = async (callback) => callback({ id: 'tx-export' });
const ExportRequestService = require('../../src/application/services/ExportRequestService');

const detail = (id = 1) => ({
  request: {
    id, requestCode: 'PX-2026-001', branchId: 1, repairOrderId: 9,
    repairOrderCode: 'RO-2026-009', customerName: 'Nguyễn Văn A', vehiclePlate: '30A-123.45',
    performedBy: 7, performedByName: 'Nguyễn Văn Kho', receivedBy: 21,
    receivedByName: 'Trần Văn Thợ', receivedSignatureData: 'data:image/png;base64,abc123',
    receivedSignedAt: '2026-09-11T08:30:00.000Z', exportDate: '2026-09-11',
    status: 'completed', createdAt: '2026-09-11T08:30:00.000Z',
  },
  items: [{ id: 1, exportRequestId: id, productId: 11, productCode: 'PT-001', productName: 'Lọc dầu', unit: 'Cái', quantity: 2 }],
});

const makeService = (exportRequestRepository = {}) => new ExportRequestService({ exportRequestRepository });
const expectError = (action, statusCode, message) => assert.rejects(action, (error) => error.statusCode === statusCode && error.message === message);

test('returns export requests matching the visible filters', async () => {
  let received;
  const service = makeService({
    findAll: async (filters) => { received = filters; return [detail().request]; },
    count: async () => 1,
  });
  const result = await service.list({ branchId: 1, status: 'completed', fromDate: '2026-09-01', toDate: '2026-09-11', search: 'PX-2026', page: 1, limit: 20 });
  assert.deepEqual(received, { branchId: 1, status: 'completed', repairOrderId: undefined, fromDate: new Date('2026-09-01'), toDate: new Date('2026-09-11'), search: 'PX-2026', includeOpen: false, page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].requestCode, 'PX-2026-001');
});

test('returns an empty export-request list when no keyword matches', async () => {
  const service = makeService({ findAll: async () => [], count: async () => 0 });
  const result = await service.list({ branchId: 1, search: 'không có', page: 1, limit: 20 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('rejects an export-request end date before its start date', async () => {
  const service = makeService({ findAll: async () => [], count: async () => 0 });
  await assert.rejects(() => service.list({ branchId: 1, fromDate: '2026-09-11', toDate: '2026-09-01' }), (error) => error.statusCode === 400);
});

test('returns export-request details for an existing id', async () => {
  const result = await makeService({ findById: async () => detail() }).getById(1, { branchId: 1 });
  assert.equal(result.id, 1);
  assert.equal(result.requestCode, 'PX-2026-001');
  assert.equal(result.repairOrderCode, 'RO-2026-009');
  assert.equal(result.items[0].quantity, 2);
});

test('reports a missing export-request id', async () => {
  const service = makeService({ findById: async () => null });
  await expectError(() => service.getById(999, { branchId: 1 }), 404, 'Không tìm thấy phiếu xuất');
});

test('returns repair orders matching the export-form keyword', async () => {
  let received;
  const service = makeService({
    findExportableRepairOrders: async (filters) => { received = filters; return [{ id: 9, repairOrderCode: 'RO-2026-009', customerName: 'Nguyễn Văn A', vehiclePlate: '30A-123.45' }]; },
    countExportableRepairOrders: async () => 1,
  });
  const result = await service.listExportableRepairOrders({ branchId: 1, search: 'RO-2026', page: 1, limit: 20 });
  assert.deepEqual(received, { branchId: 1, search: 'RO-2026', page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].repairOrderCode, 'RO-2026-009');
});

test('returns an empty repair-order list when the export-form keyword does not match', async () => {
  const service = makeService({ findExportableRepairOrders: async () => [], countExportableRepairOrders: async () => 0 });
  const result = await service.listExportableRepairOrders({ branchId: 1, search: 'không có', page: 1, limit: 20 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});

test('returns repair-order details for an existing exportable order', async () => {
  const service = makeService({ findRepairOrderForExport: async () => ({ id: 9, repairOrderCode: 'RO-2026-009', locked: false, items: [{ productId: 11, productName: 'Lọc dầu', pendingQuantity: 2 }] }) });
  const result = await service.getRepairOrderForExport(9);
  assert.equal(result.repairOrderCode, 'RO-2026-009');
  assert.equal(result.locked, false);
  assert.equal(result.items[0].pendingQuantity, 2);
});

test('reports a missing repair order on the export form', async () => {
  const service = makeService({ findRepairOrderForExport: async () => null });
  await expectError(() => service.getRepairOrderForExport(999), 404, 'Không tìm thấy lệnh sửa chữa');
});

test('confirms pickup with the selected order, receiver, signature, and part rows', async () => {
  let received;
  const service = makeService({ confirmPickup: async (tx, data) => { received = { tx, data }; return detail(); } });
  const result = await service.confirmPickup({
    branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21,
    receivedSignatureData: 'data:image/png;base64,abc123',
    issuerSignatureData: 'data:image/png;base64,kho1', productIds: [11, 12, 11],
  });
  assert.equal(received.tx.id, 'tx-export');
  assert.equal(received.data.repair_order_id, 9);
  assert.equal(received.data.received_by, 21);
  assert.deepEqual(received.data.product_ids, [11, 12]);
  assert.equal(result.status, 'completed');
  assert.equal(result.requestCode, 'PX-2026-001');
});

test('requires a repair order when confirming pickup', async () => {
  const service = makeService();
  await expectError(() => service.confirmPickup({ branchId: 1, performedBy: 7, receivedBy: 21, receivedSignatureData: 'data:image/png;base64,abc123', productIds: [11] }), 400, 'Vui lòng chọn lệnh sửa chữa');
});

test('requires a receiver when confirming pickup', async () => {
  const service = makeService();
  await expectError(() => service.confirmPickup({ branchId: 1, repairOrderId: 9, performedBy: 7, receivedSignatureData: 'data:image/png;base64,abc123', productIds: [11] }), 400, 'Vui lòng chọn người lấy');
});

test('requires a signature when confirming pickup', async () => {
  const service = makeService();
  await expectError(() => service.confirmPickup({ branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21, productIds: [11] }), 400, 'Vui lòng ký xác nhận');
});

test('requires a warehouse-staff signature on EVERY pickup, not just the first', async () => {
  let received;
  const service = makeService({ confirmPickup: async (tx, data) => { received = data; return detail(); } });
  const base = { branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21, receivedSignatureData: 'data:image/png;base64,abc123', productIds: [11] };

  // Moi lan xuat/tra deu phai co chu ky NV kho rieng - co the la nguoi khac
  // lan truoc, khong con "ky 1 lan dung mai".
  await service.confirmPickup({ ...base, issuerSignatureData: 'data:image/png;base64,kho999' });
  assert.equal(received.issuer_signature_data, 'data:image/png;base64,kho999');

  // Khong gui chu ky NV kho -> loi, du la lan dau hay lan sau.
  await expectError(() => service.confirmPickup(base), 400, 'Vui lòng ký xác nhận (nhân viên kho)');
  await expectError(() => service.confirmPickup({ ...base, issuerSignatureData: 'not-a-png' }), 400, 'Vui lòng ký xác nhận (nhân viên kho)');
});

test('requires at least one selected part row when confirming pickup', async () => {
  const service = makeService();
  await expectError(() => service.confirmPickup({
    branchId: 1, repairOrderId: 9, performedBy: 7, receivedBy: 21,
    receivedSignatureData: 'data:image/png;base64,abc123',
    issuerSignatureData: 'data:image/png;base64,kho1', productIds: [],
  }), 400, 'Chưa chọn dòng phụ tùng nào để xác nhận');
});
