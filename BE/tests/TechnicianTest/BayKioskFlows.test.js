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
    findPublicProgressByCode: async () => null,
    findByCode: async () => null,
    reportBayCompleted: async () => null,
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

// Bam "Hoan thanh" o khoang chi la BAO XONG VIEC - lenh chuyen sang cho to
// truong xac nhan, chua giai phong khoang va phieu quyet toan ben CVDV van
// "dang sua chua". Xem RepairOrderService.reportBayCompleted.
test('BayScreen report done when all service tasks done', async () => {
  const tasks = [
    { id: 500, taskType: 'service', isDone: true, isCancelled: false, taskName: 'Cong DV' },
    { id: 501, taskType: 'product', isDone: false, isCancelled: false, taskName: 'Phu tung' },
  ];
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...bayOrder, tasks }),
      reportBayCompleted: async () => ({ ...bayOrder, status: 'awaiting_confirmation', tasks }),
    }),
  });
  const dto = await service.reportBayCompleted(70, { branchId: 1 });
  assert.equal(dto.status, 'awaiting_confirmation');
});

test('BayScreen reject report done when a service task is still open', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...bayOrder }),
    }),
  });
  await assert.rejects(
    () => service.reportBayCompleted(70, { branchId: 1 }),
    (err) => err.statusCode === 409 && /tất cả đầu mục/.test(err.message),
  );
});

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
