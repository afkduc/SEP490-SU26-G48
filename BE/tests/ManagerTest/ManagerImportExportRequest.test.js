const test = require('node:test');
const assert = require('node:assert/strict');
const ImportRequestService = require('../../src/application/services/ImportRequestService');
const ExportRequestService = require('../../src/application/services/ExportRequestService');

// Cac ham rieng cua role Manager tren 2 service nay:
//   - ImportRequestService.approve / reject (Manager duyet/tu choi phieu nhap)
//   - ImportRequestService/ExportRequestService.markSeenByManager, countNewForManager
//     (thong bao cham do + so do canh "Phieu nhap"/"Phieu xuat" tren Navbar)
// WarehouseStaffTest da co san cho create()/list() tu goc nhin NVKho, file nay
// chi tap trung phan Manager dung, chua duoc test o dau khac.

function mockImportRepo(overrides = {}) {
  return {
    findById: async (id) => ({
      request: {
        id,
        requestCode: 'IRB-1-20260804-0001',
        branchId: 1,
        status: 'approved',
        items: [],
      },
      items: [],
    }),
    approve: async () => ({ ok: true }),
    reject: async () => true,
    markSeenByManager: async () => {},
    countNewForManager: async () => 3,
    ...overrides,
  };
}

function mockExportRepo(overrides = {}) {
  return {
    markSeenByManager: async () => {},
    countNewForManager: async () => 2,
    ...overrides,
  };
}

// ─── ImportRequestService.approve (Manager duyet phieu nhap) ─────────

test('ImportRequestService.approve validates id and approvedBy', async () => {
  const service = new ImportRequestService({
    importRequestRepository: mockImportRepo(),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  await assert.rejects(
    () => service.approve('abc', { approvedBy: 7 }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => service.approve(1, {}),
    (err) => err.statusCode === 400 && /approvedBy/i.test(err.message),
  );
});

test('ImportRequestService.approve 409s when request is not pending', async () => {
  const service = new ImportRequestService({
    importRequestRepository: mockImportRepo({ approve: async () => null }),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  await assert.rejects(
    () => service.approve(1, { approvedBy: 7, branchId: 1 }),
    (err) => err.statusCode === 409,
  );
});

test('ImportRequestService.approve succeeds and scopes getById to branch', async () => {
  const calls = [];
  const service = new ImportRequestService({
    importRequestRepository: mockImportRepo({
      approve: async (tx, id, approvedBy, importDate, opts) => {
        calls.push(['approve', id, approvedBy, opts]);
        return { ok: true };
      },
      findById: async (id, opts) => {
        calls.push(['findById', id, opts]);
        return { request: { id, requestCode: 'IRB-1-20260804-0001', branchId: 1, status: 'approved' }, items: [] };
      },
    }),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  const dto = await service.approve(1, { approvedBy: 7, branchId: 1 });
  assert.equal(dto.status, 'approved');
  assert.deepEqual(calls[0], ['approve', 1, 7, { branchId: 1 }]);
  assert.deepEqual(calls[1], ['findById', 1, { branchId: 1 }]);
});

// ─── ImportRequestService.reject (Manager tu choi phieu nhap) ────────

test('ImportRequestService.reject validates id and requires a non-empty reason', async () => {
  const service = new ImportRequestService({
    importRequestRepository: mockImportRepo(),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  await assert.rejects(
    () => service.reject('abc', { rejectReason: 'ly do' }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => service.reject(1, { rejectReason: '   ' }),
    (err) => err.statusCode === 400 && /rejectReason/i.test(err.message),
  );
});

test('ImportRequestService.reject 409s when request is not pending, succeeds otherwise', async () => {
  const serviceFail = new ImportRequestService({
    importRequestRepository: mockImportRepo({ reject: async () => false }),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  await assert.rejects(
    () => serviceFail.reject(1, { rejectReason: 'Sai so luong' }, { branchId: 1 }),
    (err) => err.statusCode === 409,
  );

  const serviceOk = new ImportRequestService({
    importRequestRepository: mockImportRepo({
      reject: async () => true,
      findById: async (id) => ({ request: { id, status: 'rejected', branchId: 1 }, items: [] }),
    }),
    transactionRunner: async (cb) => cb({ id: 'tx' }),
  });
  const dto = await serviceOk.reject(1, { rejectReason: 'Sai so luong' }, { branchId: 1 });
  assert.equal(dto.status, 'rejected');
});

// ─── markSeenByManager / countNewForManager (Import) ─────────────────

test('ImportRequestService.markSeenByManager validates id and calls repository', async () => {
  const service = new ImportRequestService({ importRequestRepository: mockImportRepo() });
  await assert.rejects(
    () => service.markSeenByManager('abc'),
    (err) => err.statusCode === 400,
  );

  const calls = [];
  const serviceOk = new ImportRequestService({
    importRequestRepository: mockImportRepo({
      markSeenByManager: async (id) => { calls.push(id); },
    }),
  });
  await serviceOk.markSeenByManager('7');
  assert.deepEqual(calls, [7]);
});

test('ImportRequestService.countNewForManager requires branchId and returns repo count', async () => {
  const service = new ImportRequestService({ importRequestRepository: mockImportRepo() });
  await assert.rejects(
    () => service.countNewForManager(null),
    (err) => err.statusCode === 400,
  );
  const count = await service.countNewForManager(1);
  assert.equal(count, 3);
});

// ─── markSeenByManager / countNewForManager (Export) ──────────────────

test('ExportRequestService.markSeenByManager validates id and calls repository', async () => {
  const service = new ExportRequestService({ exportRequestRepository: mockExportRepo() });
  await assert.rejects(
    () => service.markSeenByManager('abc'),
    (err) => err.statusCode === 400,
  );

  const calls = [];
  const serviceOk = new ExportRequestService({
    exportRequestRepository: mockExportRepo({
      markSeenByManager: async (id) => { calls.push(id); },
    }),
  });
  await serviceOk.markSeenByManager('9');
  assert.deepEqual(calls, [9]);
});

test('ExportRequestService.countNewForManager requires branchId and returns repo count', async () => {
  const service = new ExportRequestService({ exportRequestRepository: mockExportRepo() });
  await assert.rejects(
    () => service.countNewForManager(undefined),
    (err) => err.statusCode === 400,
  );
  const count = await service.countNewForManager(1);
  assert.equal(count, 2);
});
