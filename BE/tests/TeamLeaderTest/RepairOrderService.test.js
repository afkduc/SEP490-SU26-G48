const test = require('node:test');
const assert = require('node:assert/strict');
const RepairOrderService = require('../../src/application/services/RepairOrderService');

function mockRepo(overrides = {}) {
  return {
    findAll: async () => [],
    findById: async () => null,
    findPublicProgressByCode: async () => null,
    findByCode: async () => null,
    findEligibleRepairOrder: async () => null,
    claim: async () => null,
    searchTechnicians: async () => [],
    setTechnicians: async () => true,
    reportBayCompleted: async () => null,
    reopenTask: async () => null,
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

// Sau khi gop bang chi con DUY NHAT 1 ma "RO-..." - truoc day phai tra cuu 2
// lan (order_code cua phieu, roi fallback sang repair_code "LSC-..." cua lenh
// sua chua) vi 1 viec co 2 ma. Xem ensureRepairOrderMerge.
test('getPublicProgressByCode tim theo ma RO duy nhat (da trim)', async () => {
  const entity = { id: 1, code: 'RO-2026-068', status: 'inprogress', tasks: [] };
  let asked = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findPublicProgressByCode: async (code) => { asked = code; return code === 'RO-2026-068' ? entity : null; },
    }),
  });
  const dto = await service.getPublicProgressByCode('  RO-2026-068  ');
  assert.ok(dto);
  assert.equal(asked, 'RO-2026-068');
});

test('getPublicProgressByCode 404 when not found', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.getPublicProgressByCode('RO-NOPE'),
    (err) => err.statusCode === 404,
  );
});

test('claim requires repairOrderId and teamLeader/bay', async () => {
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
      findEligibleRepairOrder: async () => ({ id: 50, vehicle_id: 1, status: 'inprogress' }),
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
    bayId: 3,
    bayNumber: 2,
    status: 'inprogress',
    tasks: [],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findEligibleRepairOrder: async () => ({ id: 50, vehicle_id: 9, status: 'waiting_repair' }),
      claim: async () => claimed,
    }),
  });
  const dto = await service.claim(50, { branchId: 1, teamLeaderId: 8, bayId: 3, bayNumber: 2 });
  assert.equal(dto.id, 70);
});

test('claim 409 on race (repo returns null)', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findEligibleRepairOrder: async () => ({ id: 50, vehicle_id: 9, status: 'waiting_repair' }),
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

test('reportBayCompleted rejects when no technician assigned yet', async () => {
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
    () => service.reportBayCompleted(70, { branchId: 1 }),
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

test('reportBayCompleted requires all service tasks done', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.reportBayCompleted(70, { branchId: 1 }),
    (err) => err.statusCode === 409 && /tất cả đầu mục/.test(err.message),
  );
});

// Khoang bao xong viec KHONG ket thuc lenh: lenh chuyen sang cho to truong
// xac nhan, phieu quyet toan ben CVDV van "dang sua chua".
test('reportBayCompleted ignores cancelled service tasks and only awaits confirmation', async () => {
  const tasks = [
    { id: 500, taskType: 'service', isDone: true, isCancelled: false },
    { id: 502, taskType: 'service', isDone: false, isCancelled: true },
    { id: 501, taskType: 'product', taskName: 'Phu tung', isDone: false, isCancelled: false },
  ];
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, tasks }),
      reportBayCompleted: async () => ({ ...inProgressOrder, status: 'awaiting_confirmation', tasks }),
    }),
  });
  const dto = await service.reportBayCompleted(70, { branchId: 1 });
  assert.equal(dto.status, 'awaiting_confirmation');
});

test('reportBayCompleted rejects when bay already reported', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        status: 'awaiting_confirmation',
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.reportBayCompleted(70, { branchId: 1 }),
    (err) => err.statusCode === 409 && /chờ tổ trưởng xác nhận/.test(err.message),
  );
});

// To truong go tich 1 dau muc da xong = yeu cau lam lai. Thay cho 1 nut
// "tra ve lam tiep" rieng - xem RepairOrderService.reopenTask.
test('reopenTask rejects a task that is not done yet', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.reopenTask(70, 500, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /chưa hoàn thành/.test(err.message),
  );
});

test('reopenTask rejects another team leader', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.reopenTask(70, 500, { branchId: 1, teamLeaderId: 99 }),
    (err) => err.statusCode === 403,
  );
});

test('reopenTask rejects a task the customer already cancelled', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: true }],
      }),
    }),
  });
  await assert.rejects(
    () => service.reopenTask(70, 500, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /khách hủy/.test(err.message),
  );
});

// Go tich khi lenh dang CHO XAC NHAN -> lenh quay ve "dang lam" de khoang
// lam tiep, khong ket cung.
test('reopenTask sends an awaiting-confirmation order back to inprogress', async () => {
  let reopened = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        status: 'awaiting_confirmation',
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
      reopenTask: async (id, taskId) => {
        reopened = [Number(id), Number(taskId)];
        return {
          ...inProgressOrder,
          status: 'inprogress',
          tasks: [{ id: 500, taskType: 'service', isDone: false, isCancelled: false }],
        };
      },
    }),
  });
  const dto = await service.reopenTask(70, 500, { branchId: 1, teamLeaderId: 8 });
  assert.deepEqual(reopened, [70, 500]);
  assert.equal(dto.status, 'inprogress');
  assert.equal(dto.tasks[0].isDone, false);
});

test('confirmCompleted rejects when bay has not reported yet', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /chưa báo xong việc/.test(err.message),
  );
});

test('confirmCompleted rejects another team leader', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        status: 'awaiting_confirmation',
        tasks: [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }],
      }),
    }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 99 }),
    (err) => err.statusCode === 403,
  );
});

// Chi buoc nay moi that su ket thuc lenh -> phieu quyet toan chuyen
// "Cho thanh toan" ben man CVDV.
test('confirmCompleted completes the order', async () => {
  const tasks = [{ id: 500, taskType: 'service', isDone: true, isCancelled: false }];
  let completedWith = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, status: 'awaiting_confirmation', tasks }),
      updateStatus: async (id, status) => {
        completedWith = status;
        return { ...inProgressOrder, status: 'completed', tasks };
      },
    }),
  });
  const dto = await service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 });
  assert.equal(completedWith, 'completed');
  assert.equal(dto.status, 'completed');
});
