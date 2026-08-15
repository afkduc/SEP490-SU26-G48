const test = require('node:test');
const assert = require('node:assert/strict');
const RepairOrderService = require('../../src/application/services/RepairOrderService');

function mockRepo(overrides = {}) {
  return {
    findAll: async () => [],
    findById: async () => null,
    findByServiceOrderCode: async () => null,
    findByCode: async () => null,
    findEligibleServiceOrder: async () => null,
    claim: async () => null,
    searchTechnicians: async () => [],
    setTechnicians: async () => true,
    updateStatus: async () => null,
    updateTaskStatus: async () => {},
    ...overrides,
  };
}

const inProgressOrder = {
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
    { id: 500, taskType: 'service', isDone: false, isCancelled: false },
    { id: 501, taskType: 'product', isDone: false, isCancelled: false },
  ],
};

test('getPublicProgressByCode rejects empty code', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.getPublicProgressByCode('   '),
    (err) => err.statusCode === 400 && /Vui lòng nhập mã sửa chữa/.test(err.message),
  );
});

test('getPublicProgressByCode finds by settlement order_code first', async () => {
  const entity = { id: 1, code: 'LSC-1', serviceOrderCode: 'RO-2026-068', status: 'inprogress', tasks: [] };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findByServiceOrderCode: async (code) => (code === 'RO-2026-068' ? entity : null),
    }),
  });
  const dto = await service.getPublicProgressByCode('  RO-2026-068  ');
  assert.ok(dto);
});

test('getPublicProgressByCode falls back to repair_code', async () => {
  const entity = { id: 2, code: 'LSC-2026-001', status: 'inprogress', tasks: [] };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findByCode: async (code) => (code === 'LSC-2026-001' ? entity : null),
    }),
  });
  const dto = await service.getPublicProgressByCode('LSC-2026-001');
  assert.ok(dto);
});

test('getPublicProgressByCode 404 when not found', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.getPublicProgressByCode('RO-NOPE'),
    (err) => err.statusCode === 404,
  );
});

test('claim requires serviceOrderId and teamLeader/bay', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.claim(null, { branchId: 1, teamLeaderId: 8, bayId: 3 }),
    (err) => err.statusCode === 400 && /Thiếu phiếu quyết toán/.test(err.message),
  );
  await assert.rejects(
    () => service.claim(50, { branchId: 1, teamLeaderId: null, bayId: 3 }),
    (err) => err.statusCode === 400 && /Thiếu thông tin tổ trưởng\/khoang xe/.test(err.message),
  );
});

test('claim rejects when settlement not waiting_repair', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findEligibleServiceOrder: async () => ({ id: 50, vehicle_id: 1, status: 'inprogress' }),
    }),
  });
  await assert.rejects(
    () => service.claim(50, { branchId: 1, teamLeaderId: 8, bayId: 3, bayNumber: 2 }),
    (err) => err.statusCode === 409,
  );
});

test('claim succeeds and returns DTO', async () => {
  const claimed = {
    id: 70,
    code: 'LSC-1',
    branchId: 1,
    teamLeaderId: 8,
    serviceOrderId: 50,
    bayId: 3,
    bayNumber: 2,
    status: 'inprogress',
    tasks: [],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findEligibleServiceOrder: async () => ({ id: 50, vehicle_id: 9, status: 'waiting_repair' }),
      claim: async () => claimed,
    }),
  });
  const dto = await service.claim(50, { branchId: 1, teamLeaderId: 8, bayId: 3, bayNumber: 2 });
  assert.equal(dto.id, 70);
});

test('claim 409 on race (repo returns null)', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findEligibleServiceOrder: async () => ({ id: 50, vehicle_id: 9, status: 'waiting_repair' }),
      claim: async () => null,
    }),
  });
  await assert.rejects(
    () => service.claim(50, { branchId: 1, teamLeaderId: 8, bayId: 3, bayNumber: 2 }),
    (err) => err.statusCode === 409 && /khoang khác nhận/.test(err.message),
  );
});

test('setTechnicians requires at least one technician', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.setTechnicians(70, [], { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 400 && /ít nhất 1 thợ/.test(err.message),
  );
});

test('setTechnicians only assigned team leader can assign', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.setTechnicians(70, [101], { branchId: 1, teamLeaderId: 99 }),
    (err) => err.statusCode === 403,
  );
});

test('setTechnicians rejects cancelled order with ORDER_CANCELLED', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        status: 'cancelled',
        cancelReason: 'Khách đổi ý',
      }),
    }),
  });
  await assert.rejects(
    () => service.setTechnicians(70, [101], { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && err.code === 'ORDER_CANCELLED',
  );
});

test('setTechnicians dedupes ids and succeeds', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, technicians: [{ id: 101 }, { id: 102 }] }),
      setTechnicians: async (_id, _tl, _br, ids) => {
        assert.deepEqual(ids, [101, 102]);
        return true;
      },
    }),
  });
  const dto = await service.setTechnicians(70, [101, 101, 102], { branchId: 1, teamLeaderId: 8 });
  assert.equal(dto.id, 70);
});

test('updateTaskStatus only allows service tasks one-way tick', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 501, true, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 400 && /đầu mục dịch vụ/.test(err.message),
  );
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, false, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 400 && /Không thể bỏ tích/.test(err.message),
  );
});

test('updateTaskStatus rejects when no technician assigned yet', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, technicians: [] }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 409 && /chưa được gán thợ/.test(err.message),
  );
});

test('updateStatus rejects completing order when no technician assigned yet', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        technicians: [],
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.updateStatus(70, 'completed', { branchId: 1 }),
    (err) => err.statusCode === 409 && /chưa được gán thợ/.test(err.message),
  );
});

test('updateTaskStatus rejects already done task', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 409,
  );
});

test('updateTaskStatus ticks service task', async () => {
  let updated = false;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: updated
          ? [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }]
          : [{ id: 500, taskType: 'service', isDone: false, isCancelled: false }],
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

test('updateStatus only accepts completed and requires all service tasks done', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.updateStatus(70, 'cancelled', { branchId: 1 }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => service.updateStatus(70, 'completed', { branchId: 1 }),
    (err) => err.statusCode === 409 && /tất cả đầu mục/.test(err.message),
  );
});

test('updateStatus ignores cancelled service tasks when checking completion', async () => {
  const completed = {
    ...inProgressOrder,
    status: 'completed',
    tasks: [
      { id: 500, taskType: 'service', isDone: true, isCancelled: false },
      { id: 502, taskType: 'service', isDone: false, isCancelled: true },
      { id: 501, taskType: 'product', isDone: false, isCancelled: false },
    ],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: completed.tasks,
      }),
      updateStatus: async () => completed,
    }),
  });
  const dto = await service.updateStatus(70, 'completed', { branchId: 1 });
  assert.equal(dto.status, 'completed');
});
