const {
  test
} = require('@jest/globals');
const assert = require('node:assert/strict');
const ImportRequestService = require('../../src/application/services/ImportRequestService');
const ExportRequestService = require('../../src/application/services/ExportRequestService');
const importData = id => ({
  request: {
    id,
    requestCode: 'IRB-1',
    branchId: 1,
    status: 'pending'
  },
  items: []
});
const exportData = id => ({
  request: {
    id,
    requestCode: 'EXB-1',
    branchId: 1
  },
  items: []
});
const importRepo = (overrides = {}) => ({
  findAll: async () => [],
  count: async () => 0,
  findById: async id => importData(id),
  ...overrides
});
const exportRepo = (overrides = {}) => ({
  findAll: async () => [],
  count: async () => 0,
  findById: async id => exportData(id),
  ...overrides
});
test('ImportRequestService.list displays matching import requests', async () => {
  let received;
  const service = new ImportRequestService({
    importRequestRepository: importRepo({
      findAll: async filters => {
        received = filters;
        return [importData(7).request];
      },
      count: async () => 1
    })
  });
  const result = await service.list({
    branchId: 1,
    status: 'pending',
    search: 'IRB',
    fromDate: '2026-09-01',
    toDate: '2026-09-10'
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 7);
  assert.equal(received.search, 'IRB');
  assert.equal(received.status, 'pending');
  assert.equal(received.fromDate.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(received.toDate.toISOString(), '2026-09-10T00:00:00.000Z');
});
test('ImportRequestService.list displays an empty import request list', async () => {
  const service = new ImportRequestService({
    importRequestRepository: importRepo()
  });
  assert.equal((await service.list({
    branchId: 1,
    status: 'all',
    search: 'không có',
    fromDate: null,
    toDate: null
  })).total, 0);
});
test('ImportRequestService.getById displays an existing import request', async () => {
  const service = new ImportRequestService({
    importRequestRepository: importRepo()
  });
  assert.equal((await service.getById(7, {
    branchId: 1
  })).id, 7);
});
test('ImportRequestService.getById reports a missing import request', async () => {
  const service = new ImportRequestService({
    importRequestRepository: importRepo({
      findById: async () => null
    })
  });
  await assert.rejects(() => service.getById(99999, {
    branchId: 1
  }), error => error.statusCode === 404 && error.message === 'Không tìm thấy phiếu nhập');
});
test('ExportRequestService.list displays matching export requests', async () => {
  let received;
  const service = new ExportRequestService({
    exportRequestRepository: exportRepo({
      findAll: async filters => {
        received = filters;
        return [exportData(7).request];
      },
      count: async () => 1
    })
  });
  const result = await service.list({
    branchId: 1,
    status: 'completed',
    search: 'EXB',
    fromDate: '2026-09-01',
    toDate: '2026-09-10'
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 7);
  assert.equal(received.search, 'EXB');
  assert.equal(received.status, 'completed');
  assert.equal(received.fromDate.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(received.toDate.toISOString(), '2026-09-10T00:00:00.000Z');
});
test('ExportRequestService.list displays an empty export request list', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: exportRepo()
  });
  assert.equal((await service.list({
    branchId: 1,
    status: 'all',
    search: 'không có',
    fromDate: null,
    toDate: null
  })).total, 0);
});
test('ExportRequestService.getById displays an existing export request', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: exportRepo()
  });
  assert.equal((await service.getById(7, {
    branchId: 1
  })).id, 7);
});
test('ExportRequestService.getById reports a missing export request', async () => {
  const service = new ExportRequestService({
    exportRequestRepository: exportRepo({
      findById: async () => null
    })
  });
  await assert.rejects(() => service.getById(99999, {
    branchId: 1
  }), error => error.statusCode === 404 && error.message === 'Không tìm thấy phiếu xuất');
});
