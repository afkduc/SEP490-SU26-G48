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
    reopenTask: async () => null,
    forwardNgTask: async () => true,
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

// Go tich 1 dau muc da xong -> dau muc mo lai, lenh van dang lam nen to
// truong chua bam Hoan thanh duoc cho den khi tho lam lai xong.
test('reopenTask reopens a completed task and keeps the order inprogress', async () => {
  let reopened = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
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

test('confirmCompleted rejects when no technician assigned yet', async () => {
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
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /chưa được gán thợ/.test(err.message),
  );
});

test('confirmCompleted requires all service tasks done', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /tất cả đầu mục/.test(err.message),
  );
});

// Dau muc bi khach huy giua chung khong tinh vao dieu kien ket thuc, neu
// khong lenh se vinh vien khong hoan thanh duoc sau khi CVDV huy 1 hang muc.
test('confirmCompleted ignores cancelled service tasks', async () => {
  const tasks = [
    { id: 500, taskType: 'service', isDone: true, isCancelled: false },
    { id: 502, taskType: 'service', isDone: false, isCancelled: true },
    { id: 501, taskType: 'product', taskName: 'Phu tung', isDone: false, isCancelled: false },
  ];
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, tasks }),
      updateStatus: async () => ({ ...inProgressOrder, status: 'completed', tasks }),
    }),
  });
  const dto = await service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 });
  assert.equal(dto.status, 'completed');
});

// Tho cham "Khong dat" -> 'reported' -> to truong bao co van -> 'pending'.
// Con dung o bat ky chang nao thi KHONG duoc dong lenh: xe ra khoi xuong ma
// khach chua he duoc bao co hang muc can thay. Xem ensureNgDecision.js.
test('confirmCompleted blocks while an NG item is still waiting for the customer', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
        tasks: [
          { id: 500, taskType: 'service', taskName: 'Ga lạnh hệ thống điều hòa', isDone: true, isCancelled: false, checkResult: 'NG', ngDecision: 'pending' },
        ],
      }),
    }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409
      && /chưa được cố vấn dịch vụ trao đổi với khách/.test(err.message)
      && /Ga lạnh hệ thống điều hòa/.test(err.message),
  );
});

test('confirmCompleted passes once every NG item has a customer decision', async () => {
  const tasks = [
    { id: 500, taskType: 'service', isDone: true, isCancelled: false, checkResult: 'NG', ngDecision: 'declined' },
    { id: 501, taskType: 'service', isDone: true, isCancelled: false, checkResult: 'NG', ngDecision: 'accepted' },
    { id: 502, taskType: 'service', isDone: true, isCancelled: false, checkResult: 'OK' },
  ];
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder, tasks }),
      updateStatus: async () => ({ ...inProgressOrder, status: 'completed', tasks }),
    }),
  });
  const dto = await service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 });
  assert.equal(dto.status, 'completed');
});

test('confirmCompleted rejects another team leader', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({
        ...inProgressOrder,
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
      findById: async () => ({ ...inProgressOrder, tasks }),
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

// ─── To truong bao co van hang muc "Khong dat" ──────────────────────────────
// Khoang xe khong noi thang duoc voi co van: tho cham Khong dat thi dau muc
// dung o 'reported' cho to truong xem lai roi moi chuyen len.

const ngOrder = {
  ...inProgressOrder,
  tasks: [
    { id: 500, taskType: 'service', taskName: 'Ga lạnh hệ thống điều hòa', isDone: true, isCancelled: false, checkResult: 'NG', ngDecision: 'reported', checkNote: 'thiếu ga' },
    { id: 501, taskType: 'service', taskName: 'Lọc gió điều hòa', isDone: true, isCancelled: false, checkResult: 'OK', ngDecision: null },
  ],
};

test('forwardNgTask chuyen dau muc tu "reported" sang "pending"', async () => {
  let goiVoi = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...ngOrder }),
      forwardNgTask: async (id, taskId) => { goiVoi = [id, taskId]; return true; },
    }),
  });
  const dto = await service.forwardNgTask(70, 500, { branchId: 1, teamLeaderId: 8 });
  assert.deepEqual(goiVoi, [70, 500]);
  assert.equal(dto.id, 70);
});

test('forwardNgTask chan dau muc khong phai Khong dat', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({ findById: async () => ({ ...ngOrder }) }),
  });
  await assert.rejects(
    () => service.forwardNgTask(70, 501, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 400 && /không bị đánh Không đạt/.test(err.message),
  );
});

test('forwardNgTask chan bam 2 lan va chan to truong khac', async () => {
  const daBao = {
    ...ngOrder,
    tasks: [{ ...ngOrder.tasks[0], ngDecision: 'pending' }],
  };
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({ findById: async () => daBao }),
  });
  await assert.rejects(
    () => service.forwardNgTask(70, 500, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /đã được báo cho cố vấn/.test(err.message),
  );

  const service2 = new RepairOrderService({
    repairOrderRepository: mockRepo({ findById: async () => ({ ...ngOrder }) }),
  });
  await assert.rejects(
    () => service2.forwardNgTask(70, 500, { branchId: 1, teamLeaderId: 999 }),
    (err) => err.statusCode === 403,
  );
});

// Chua bam "Bao co van" thi loi phai chi thang vao viec cua CHINH to truong,
// khong duoc do sang co van - nguoi doc loi la nguoi phai lam tiep.
test('confirmCompleted chan khi con dau muc Khong dat chua bao co van', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({ findById: async () => ({ ...ngOrder }) }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409
      && /chưa báo cố vấn dịch vụ/.test(err.message)
      && /Ga lạnh hệ thống điều hòa/.test(err.message),
  );
});

// ─── Tick lai sau khi khach dong y thay ────────────────────────────────────
// Cham "Khong dat" xong la dau muc duoc tinh la xong (xong phan KIEM TRA).
// Khach dong y thay -> co van mo lai (is_done=0), con nguyen phan THAY THE.
// Lan tick nay la "da thay xong", KHONG hoi Dat/Khong dat lan nua va khong
// duoc ghi de len lich su NG.

function ngAcceptedOrder(overrides = {}) {
  return {
    ...inProgressOrder,
    tasks: [{
      id: 500, taskType: 'service', taskName: 'Lọc gió điều hòa',
      isDone: false, isCancelled: false, actionCode: 'M',
      checkResult: 'NG', checkNote: 'bẩn, cần thay', ngDecision: 'accepted',
      ...overrides,
    }],
  };
}

test('tick lai dau muc khach da dong y thay: khong hoi Dat/Khong dat, giu lich su NG', async () => {
  let goiVoi = null;
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ngAcceptedOrder(),
      updateTaskStatus: async (taskId, isDone, opts) => { goiVoi = { taskId, isDone, opts }; },
    }),
  });
  await service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 });
  assert.equal(goiVoi.isDone, true);
  assert.equal(goiVoi.opts.giuLichSuNg, true);
  // Khong duoc ghi de check_result/check_note - do la ly do phai thay
  assert.equal(goiVoi.opts.checkResult, null);
  assert.equal(goiVoi.opts.checkNote, null);
});

// Dau muc kiem tra BINH THUONG (chua qua NG) van bat buoc ghi ket qua.
test('dau muc kiem tra chua co quyet dinh cua khach van phai ghi Dat/Khong dat', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ngAcceptedOrder({ checkResult: null, checkNote: null, ngDecision: null }),
    }),
  });
  await assert.rejects(
    () => service.updateTaskStatus(70, 500, true, { userId: 8, branchId: 1 }),
    (err) => err.statusCode === 400 && /Đạt hoặc Không đạt/.test(err.message),
  );
});

// Khach dong y thay ma tho chua thay xong -> khong dong lenh duoc. Neu khong,
// xe ra khoi xuong voi phu tung DA TINH TIEN ma chua he thay.
test('confirmCompleted chan khi khach da dong y thay nhung tho chua thay xong', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({ findById: async () => ngAcceptedOrder() }),
  });
  await assert.rejects(
    () => service.confirmCompleted(70, { branchId: 1, teamLeaderId: 8 }),
    (err) => err.statusCode === 409 && /tất cả đầu mục/.test(err.message),
  );
});
