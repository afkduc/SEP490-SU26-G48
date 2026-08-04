const test = require('node:test');
const assert = require('node:assert/strict');
const ImportRequestService = require('../ImportRequestService');

function buildPayload() {
  return {
    branchId: 1,
    supplierId: 2,
    requestedBy: 7,
    importDate: '2026-08-04',
    items: [
      {
        productId: 11,
        productCode: 'PT-001',
        productName: 'Lọc dầu',
        unit: 'cái',
        quantity: 3,
      },
    ],
  };
}

function buildRepository(callLog, status = 'pending') {
  return {
    async findAll() {
      return [];
    },
    async count() {
      return 0;
    },
    async findById(id, options = {}) {
      callLog.push(['findById', id, options]);
      return {
        request: {
          id,
          requestCode: 'IRB-1-20260804-0001',
          branchId: 1,
          supplierId: 2,
          supplierName: 'NCC A',
          requestedBy: 7,
          requestedByName: 'NVK-01',
          approvedBy: status === 'approved' ? 7 : null,
          approvedByName: status === 'approved' ? 'NVK-01' : null,
          importDate: '2026-08-04',
          status,
          notes: null,
          createdAt: '2026-08-04T10:00:00.000Z',
        },
        items: [
          {
            id: 1,
            importRequestId: id,
            productId: 11,
            productCode: 'PT-001',
            productName: 'Lọc dầu',
            unit: 'cái',
            quantity: 3,
          },
        ],
      };
    },
    async getNextRequestCode(branchId, importDate, tx) {
      callLog.push(['getNextRequestCode', branchId, importDate instanceof Date, tx]);
      return 'IRB-1-20260804-0001';
    },
    async create(tx, requestData, items) {
      callLog.push(['create', tx, requestData.request_code, requestData.branch_id, items.length]);
      return 101;
    },
    async approve(tx, id, approvedBy, importDate, options = {}) {
      callLog.push(['approve', tx, id, approvedBy, importDate instanceof Date, options]);
      return { ok: true };
    },
    async reject() {
      return true;
    },
  };
}

test('create auto-approves warehouse import in the same transaction', async () => {
  const calls = [];
  const tx = { id: 'tx-1' };
  const repository = buildRepository(calls, 'approved');
  const service = new ImportRequestService({
    importRequestRepository: repository,
    transactionRunner: async (callback) => callback(tx),
  });

  const result = await service.create(buildPayload(), {
    autoApprove: true,
    approvedBy: 7,
  });

  assert.equal(result.status, 'approved');
  assert.deepEqual(calls.map((entry) => entry[0]), [
    'getNextRequestCode',
    'create',
    'approve',
    'findById',
  ]);
  assert.equal(calls[0][1], 1);
  assert.equal(calls[1][1], tx);
  assert.equal(calls[2][1], tx);
  assert.equal(calls[2][2], 101);
  assert.equal(calls[2][3], 7);
  assert.deepEqual(calls[2][5], { branchId: 1 });
  assert.deepEqual(calls[3][2], { branchId: 1 });
});

test('create keeps pending flow when auto-approve is disabled', async () => {
  const calls = [];
  const tx = { id: 'tx-2' };
  const repository = buildRepository(calls, 'pending');
  repository.approve = async () => {
    throw new Error('approve should not be called');
  };

  const service = new ImportRequestService({
    importRequestRepository: repository,
    transactionRunner: async (callback) => callback(tx),
  });

  const result = await service.create(buildPayload(), {
    autoApprove: false,
  });

  assert.equal(result.status, 'pending');
  assert.deepEqual(calls.map((entry) => entry[0]), [
    'getNextRequestCode',
    'create',
    'findById',
  ]);
  assert.deepEqual(calls[2][2], { branchId: 1 });
});
