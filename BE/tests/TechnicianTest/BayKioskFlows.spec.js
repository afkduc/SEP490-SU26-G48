const { test } = require('@jest/globals');
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
    findPublicProgressByCode: async () => null,
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

test('BayScreen saves an inspection item as passed', async () => {
  let received;
  const inspectionOrder = {
    ...bayOrder,
    tasks: [{ id: 500, taskType: 'service', isDone: false, isCancelled: false, taskName: 'Kiểm tra phanh', actionCode: 'I' }],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => inspectionOrder,
      updateTaskStatus: async (taskId, isDone, options) => { received = { taskId, isDone, options }; },
    }),
  });
  const dto = await service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1, checkResult: 'OK' });
  assert.equal(received.taskId, 500);
  assert.equal(received.isDone, true);
  assert.equal(received.options.checkResult, 'OK');
  assert.equal(dto.id, 70);
});

test('BayScreen saves an inspection item as failed with a note', async () => {
  let received;
  const inspectionOrder = {
    ...bayOrder,
    tasks: [{ id: 500, taskType: 'service', isDone: false, isCancelled: false, taskName: 'Kiểm tra phanh', actionCode: 'I' }],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => inspectionOrder,
      updateTaskStatus: async (taskId, isDone, options) => { received = { taskId, isDone, options }; },
    }),
  });
  const dto = await service.updateTaskStatus(70, 500, true, {
    userId: 8, branchId: 1, checkResult: 'NG', checkNote: 'Má phanh đã mòn',
  });
  assert.equal(received.options.checkResult, 'NG');
  assert.equal(received.options.checkNote, 'Má phanh đã mòn');
  assert.equal(dto.id, 70);
});

test('BayScreen requires a note for a failed inspection item', async () => {
  const inspectionOrder = {
    ...bayOrder,
    tasks: [{ id: 500, taskType: 'service', isDone: false, isCancelled: false, taskName: 'Kiểm tra phanh', actionCode: 'I' }],
  };
  const service = new RepairOrderService({ repairOrderRepository: mockRepo({ findById: async () => inspectionOrder }) });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1, checkResult: 'NG', checkNote: '' }),
    (err) => err.statusCode === 400 && /phần ghi chú/.test(err.message),
  );
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

// Khoang xe KHONG con nut ket thuc lenh - tho chi tick dau muc. Ket thuc la
// viec cua to truong (RepairOrderService.confirmCompleted, co kiem tra quyen
// va dieu kien du dau muc), nen o day khong con test nao cho buoc do.

test('Landing tra-cuu progress theo ma RO duy nhat', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findPublicProgressByCode: async (code) => (
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
