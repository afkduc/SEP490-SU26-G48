const test = require('node:test');
const assert = require('node:assert/strict');
const RepairOrderService = require('../../src/application/services/RepairOrderService');

/**
 * Landing /khoang (BayScreen) — technician kiosk flows go through RepairOrderService
 * with userId = bay.teamLeaderId (no JWT).
 */
function mockRepo(overrides = {}) {
  return {
    findAll: async () => [],
    findById: async () => null,
    findByServiceOrderCode: async () => null,
    findByCode: async () => null,
    updateStatus: async () => null,
    updateTaskStatus: async () => {},
    ...overrides,
  };
}

const bayOrder = {
  id: 70,
  code: 'LSC-2026-001',
  branchId: 1,
  teamLeaderId: 8,
  serviceOrderId: 50,
  bayId: 3,
  bayNumber: 2,
  status: 'inprogress',
  cancelReason: null,
  technicians: [{ id: 900, fullName: 'Thợ A' }],
  tasks: [
    { id: 500, taskType: 'service', isDone: false, isCancelled: false, taskName: 'Cong DV' },
    { id: 501, taskType: 'product', isDone: false, isCancelled: false, taskName: 'Phu tung' },
  ],
};

test('BayScreen tick service task via teamLeaderId identity', async () => {
  let updated = false;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...bayOrder,
        tasks: updated
          ? [{ id: 500, taskType: 'service', isDone: true, isCancelled: false, taskName: 'Cong DV' }]
          : bayOrder.tasks,
      }),
      updateTaskStatus: async () => {
        updated = true;
      },
    }),
  });
  const dto = await service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 });
  assert.equal(dto.id, 70);
  assert.equal(updated, true);
});

test('BayScreen reject tick when bay mapped to wrong team leader', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...bayOrder }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 99, branchId: 1 }),
    (err) => err.statusCode === 403,
  );
});

test('BayScreen reject tick when no technician assigned yet', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...bayOrder, technicians: [] }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 409 && /chưa được gán thợ/.test(err.message),
  );
});

test('BayScreen complete order when all service tasks done', async () => {
  const done = {
    ...bayOrder,
    status: 'completed',
    tasks: [
      { id: 500, taskType: 'service', isDone: true, isCancelled: false, taskName: 'Cong DV' },
      { id: 501, taskType: 'product', isDone: false, isCancelled: false, taskName: 'Phu tung' },
    ],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...bayOrder,
        tasks: done.tasks,
      }),
      updateStatus: async () => done,
    }),
  });
  const dto = await service.updateStatus(70, 'completed', { branchId: 1 });
  assert.equal(dto.status, 'completed');
});

test('Landing tra-cuu progress by settlement order code', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findByServiceOrderCode: async (code) => (
        code === 'RO-2026-068'
          ? { id: 1, code: 'LSC-1', status: 'inprogress', tasks: [], branchName: 'HN' }
          : null
      ),
    }),
  });
  const dto = await service.getPublicProgressByCode('RO-2026-068');
  assert.ok(dto);
  assert.equal(dto.status, 'inprogress');
});
