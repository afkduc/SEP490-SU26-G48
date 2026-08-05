const test = require('node:test');
const assert = require('node:assert/strict');
const ExportRequestService = require('../ExportRequestService');

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
