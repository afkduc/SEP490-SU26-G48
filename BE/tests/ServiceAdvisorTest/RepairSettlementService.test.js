const test = require('node:test');
const assert = require('node:assert/strict');

// Mock PayOS + audit BEFORE loading service (module cache)
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function mockRequire(id) {
  if (id === '@payos/node') {
    return {
      PayOS: class PayOS {
        constructor() {}
        paymentRequests = {
          create: async () => ({
            paymentLinkId: 'plink_1',
            qrCode: 'qr-data',
            checkoutUrl: 'https://pay.example/checkout',
          }),
        };
        webhooks = {
          verify: async (raw) => ({
            orderCode: (raw && raw.orderCode) || 123456,
            reference: 'REF-1',
          }),
        };
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

const auditHelper = require('../../src/utils/auditHelper');
auditHelper.auditCrud.lifecycle = async () => ({});

const RepairSettlementService = require('../../src/application/services/RepairSettlementService');

const validItem = {
  description: 'Thay dầu',
  lhsc: 'DV',
  httt: 'KHT',
  repairCategory: 'PM',
  qty: 1,
  unitPrice: 500000,
  discount: 0,
};

const signature = 'data:image/png;base64,iVBORw0KGgo=';

function basePayload(overrides = {}) {
  return {
    signatureData: signature,
    signerName: 'Nguyen Van A',
    customerId: 100,
    vehicleId: 200,
    currentKm: 45000,
    customerRequest: 'Bảo dưỡng 40.000km',
    items: [{ ...validItem }],
    ...overrides,
  };
}

function mockRepos(overrides = {}) {
  return {
    findAll: async () => [],
    count: async () => 0,
    findById: async () => null,
    findPendingPayosTransactions: async () => [],
    markPayosTransactionCancelled: async () => {},
    hasPaidPayosTransaction: async () => false,
    findBranchTeamLeaders: async () => [{ id: 29, name: 'Nguyễn Đình Khương', phone: null }],
    getVehicleCurrentKm: async () => null,
    findPublicHistoryByVehicleIdentifier: async () => [],
    findActiveByCustomerVehicle: async () => null,
    create: async (data, ctx) => ({
      id: 50,
      code: 'RO-2026-001',
      status: 'waiting_repair',
      branchId: ctx.branchId,
      advisorId: ctx.advisorId,
      ...data,
      customer: { fullName: 'A' },
      vehicle: { licensePlate: '30A-12345' },
      items: data.items || [],
      tasks: [],
    }),
    update: async (id, data) => ({
      id,
      code: 'RO-2026-001',
      status: 'waiting_repair',
      branchId: 1,
      ...data,
      items: data.items || [],
      tasks: [],
    }),
    updateStatus: async (id, status, opts = {}) => ({
      id,
      code: 'RO-2026-001',
      status,
      branchId: 1,
      cancelReason: opts.cancelReason || null,
      paymentMethod: opts.paymentMethod || null,
      items: [],
      tasks: [],
    }),
    wouldLoseCompletedTasks: async () => false,
    ...overrides,
  };
}

test('create requires PNG signature', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.create(basePayload({ signatureData: 'not-a-png' }), { branchId: 1, advisorId: 5 }),
    (err) => err.statusCode === 400 && /ký xác nhận/i.test(err.message),
  );
});

test('create validates km, request, items, lhsc, discount', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });

  await assert.rejects(
    () => service.create(basePayload({ currentKm: null }), { branchId: 1, advisorId: 5 }),
    (err) => err.statusCode === 400 && /km/i.test(err.message),
  );
  await assert.rejects(
    () => service.create(basePayload({ customerRequest: '  ' }), { branchId: 1, advisorId: 5 }),
    (err) => err.statusCode === 400 && /yêu cầu/i.test(err.message),
  );
  await assert.rejects(
    () => service.create(basePayload({ items: [] }), { branchId: 1, advisorId: 5 }),
    (err) => err.statusCode === 400 && /ít nhất 1 hạng mục/i.test(err.message),
  );
  await assert.rejects(
    () =>
      service.create(basePayload({ items: [{ ...validItem, unitPrice: 0 }] }), {
        branchId: 1,
        advisorId: 5,
      }),
    (err) => err.statusCode === 400 && /đơn giá/i.test(err.message),
  );
  await assert.rejects(
    () =>
      service.create(basePayload({ items: [{ ...validItem, lhsc: 'XX' }] }), {
        branchId: 1,
        advisorId: 5,
      }),
    (err) => err.statusCode === 400 && /Loại hạng mục/i.test(err.message),
  );
  await assert.rejects(
    () =>
      service.create(basePayload({ items: [{ ...validItem, discount: 101 }] }), {
        branchId: 1,
        advisorId: 5,
      }),
    (err) => err.statusCode === 400 && /0-100/i.test(err.message),
  );
});

test('create rejects DV qty=0 but allows PT qty=0', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });

  await assert.rejects(
    () =>
      service.create(basePayload({ items: [{ ...validItem, qty: 0 }] }), {
        branchId: 1,
        advisorId: 5,
      }),
    (err) => err.statusCode === 400 && /Số lượng/i.test(err.message),
  );

  const dto = await service.create(
    basePayload({
      items: [
        { ...validItem, lhsc: 'PT', qty: 0, unitPrice: 100000, description: 'Lọc dầu' },
        { ...validItem, description: 'Công thay' },
      ],
    }),
    { branchId: 1, advisorId: 5 },
  );
  assert.equal(dto.status, 'waiting_repair');
});

test('create rejects active duplicate customer+vehicle', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findActiveByCustomerVehicle: async () => ({ code: 'RO-OLD', status: 'waiting_repair' }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.create(basePayload(), { branchId: 1, advisorId: 5 }),
    (err) => err.statusCode === 409 && /đang có phiếu quyết toán/i.test(err.message),
  );
});

test('create succeeds and recalculates totals on BE', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  const dto = await service.create(
    basePayload({
      items: [{ ...validItem, unitPrice: 1000000, discount: 10, qty: 1 }],
      total: 1,
      subtotal: 1,
    }),
    { branchId: 1, advisorId: 5 },
  );
  assert.equal(dto.status, 'waiting_repair');
  assert.equal(dto.subtotal, 900000);
  assert.equal(dto.vat, 72000);
  assert.equal(dto.total, 972000);
});

test('update blocks invoiced and completed-task loss', async () => {
  const serviceInvoiced = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'invoiced', branchId: 1 }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => serviceInvoiced.update(50, basePayload()),
    (err) => err.statusCode === 409 && /xuất hóa đơn/i.test(err.message),
  );

  const serviceLose = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'inprogress', branchId: 1, repairOrderId: 70 }),
      wouldLoseCompletedTasks: async () => true,
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => serviceLose.update(50, basePayload()),
    (err) => err.statusCode === 409 && /đã được xác nhận hoàn thành/i.test(err.message),
  );
});

test('update blocks waiting_payment and cancelled (order already closed elsewhere)', async () => {
  const serviceWaitingPayment = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'waiting_payment', branchId: 1 }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => serviceWaitingPayment.update(50, basePayload()),
    (err) => err.statusCode === 409 && /hoàn thành sửa chữa hoặc đã hủy/i.test(err.message),
  );

  const serviceCancelled = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'cancelled', branchId: 1 }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => serviceCancelled.update(50, basePayload()),
    (err) => err.statusCode === 409 && /hoàn thành sửa chữa hoặc đã hủy/i.test(err.message),
  );
});

test('updateStatus cancel rules', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({
        id: 50,
        status: 'waiting_repair',
        branchId: 1,
        repairOrderId: null,
        tasks: [],
      }),
    }),
    customerRepository: {},
  });

  await assert.rejects(
    () => service.updateStatus(50, 'cancelled', { cancelReason: '' }),
    (err) => err.statusCode === 400 && /lý do hủy/i.test(err.message),
  );

  const dto = await service.updateStatus(50, 'cancelled', { cancelReason: 'Khách đổi ý' });
  assert.equal(dto.status, 'cancelled');
});

test('updateStatus cannot cancel inprogress with done tasks', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({
        id: 50,
        status: 'inprogress',
        branchId: 1,
        repairOrderId: 70,
        tasks: [{ id: 1, isDone: true }],
      }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.updateStatus(50, 'cancelled', { cancelReason: 'Muốn hủy' }),
    (err) => err.statusCode === 409 && /không thể hủy phiếu này nữa/i.test(err.message),
  );
});

test('updateStatus invoiced only from waiting_payment', async () => {
  const serviceWrong = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'waiting_repair', branchId: 1, tasks: [] }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => serviceWrong.updateStatus(50, 'invoiced', { issuedBy: 5 }),
    (err) => err.statusCode === 409 && /chờ thanh toán/i.test(err.message),
  );

  const serviceOk = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'waiting_payment', branchId: 1, tasks: [] }),
    }),
    customerRepository: {},
  });
  const dto = await serviceOk.updateStatus(50, 'invoiced', { issuedBy: 5 });
  assert.equal(dto.status, 'invoiced');
  assert.equal(dto.paymentMethod, 'CASH');
});

test('getPublicHistoryByPlateOrFrame rejects empty identifier', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.getPublicHistoryByPlateOrFrame('  '),
    (err) => err.statusCode === 400,
  );
});

test('getPublicHistoryByPlateOrFrame returns null when not found (no 404 leak)', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findPublicHistoryByVehicleIdentifier: async () => [],
    }),
    customerRepository: {},
  });
  const dto = await service.getPublicHistoryByPlateOrFrame('99Z-00000');
  assert.equal(dto, null);
});


test('getAll returns paginated items', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findAll: async () => [{
        id: 50,
        code: 'RO-1',
        status: 'waiting_repair',
        branchId: 1,
        items: [],
        tasks: [],
        customer: { fullName: 'A' },
        vehicle: { licensePlate: '30A' },
      }],
      count: async () => 1,
    }),
    customerRepository: {},
  });
  const result = await service.getAll({ branchId: 1, page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.page, 1);
});

test('getById 404 when missing', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.getById(999),
    (err) => err.statusCode === 404,
  );
});

test('getById returns DTO', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({
        id: 50,
        code: 'RO-1',
        status: 'waiting_repair',
        branchId: 1,
        items: [],
        tasks: [],
        customer: { fullName: 'A' },
        vehicle: { licensePlate: '30A' },
      }),
    }),
    customerRepository: {},
  });
  const dto = await service.getById(50);
  assert.equal(dto.id, 50);
});

test('checkActiveDuplicate returns null when missing ids or no conflict', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  assert.equal(await service.checkActiveDuplicate(null, 1), null);
  assert.equal(await service.checkActiveDuplicate(1, 2), null);
});

test('checkActiveDuplicate returns conflict payload', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findActiveByCustomerVehicle: async () => ({ code: 'RO-OLD', status: 'waiting_repair' }),
    }),
    customerRepository: {},
  });
  const conflict = await service.checkActiveDuplicate(1, 2);
  assert.equal(conflict.code, 'RO-OLD');
  assert.match(conflict.message, /đang có phiếu quyết toán/i);
});

test('getGatePending maps pending exit rows', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findGatePending: async (branchId) => {
        assert.equal(branchId, 1);
        return [{
          id: 50,
          repair_code: 'RO-1',
          customer_full_name: 'A',
          vehicle_license_plate: '30A-12345',
          vehicle_model_text: 'Kia',
        }];
      },
    }),
    customerRepository: {},
  });
  const rows = await service.getGatePending(1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'RO-1');
  assert.equal(rows[0].vehiclePlate, '30A-12345');
});

test('confirmGateExit 409 when repo returns false', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      confirmGateExit: async () => false,
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.confirmGateExit(50, 1),
    (err) => err.statusCode === 409,
  );
});

test('confirmGateExit succeeds', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      confirmGateExit: async (id, branchId) => {
        assert.equal(Number(id), 50);
        assert.equal(branchId, 1);
        return true;
      },
    }),
    customerRepository: {},
  });
  const result = await service.confirmGateExit(50, 1);
  assert.deepEqual(result, { id: 50 });
});

test('createPayosPaymentLink 404 / 409 validation', async () => {
  const missing = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  await assert.rejects(
    () => missing.createPayosPaymentLink(999),
    (err) => err.statusCode === 404,
  );

  const wrongStatus = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ id: 50, status: 'waiting_repair', branchId: 1, code: 'RO-1', total: 1000 }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => wrongStatus.createPayosPaymentLink(50),
    (err) => err.statusCode === 409 && /chờ thanh toán/i.test(err.message),
  );
});

test('createPayosPaymentLink creates QR for waiting_payment', async () => {
  let savedTx = null;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({
        id: 50,
        status: 'waiting_payment',
        branchId: 1,
        code: 'RO-2026-001',
        total: 972000,
        customer: { fullName: 'A' },
      }),
      createPayosTransaction: async (id, data) => {
        savedTx = { id, ...data };
      },
    }),
    customerRepository: {},
  });
  const link = await service.createPayosPaymentLink(50, {});
  assert.equal(link.qrCode, 'qr-data');
  assert.equal(link.checkoutUrl, 'https://pay.example/checkout');
  assert.equal(savedTx.amount, 972000);
});

test('handlePayosWebhook invoices waiting_payment settlement', async () => {
  let marked = false;
  let invoiced = false;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findPayosTransactionByOrderCode: async (orderCode) => ({
        orderCode,
        status: 'pending',
        service_order_id: 50,
        amount: 972000,
      }),
      markPayosTransactionPaid: async () => {
        marked = true;
      },
      findById: async () => ({
        id: 50,
        status: 'waiting_payment',
        branchId: 1,
        code: 'RO-1',
        advisorId: 5,
      }),
      updateStatus: async (id, status, opts) => {
        invoiced = status === 'invoiced' && opts.paymentMethod === 'TRANSFER';
        return { id, status, branchId: 1 };
      },
    }),
    customerRepository: {},
  });
  await service.handlePayosWebhook({ orderCode: 123456 }, {});
  assert.equal(marked, true);
  assert.equal(invoiced, true);
});

test('handlePayosWebhook is idempotent when already paid', async () => {
  let updateCalled = false;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findPayosTransactionByOrderCode: async () => ({
        status: 'paid',
        service_order_id: 50,
      }),
      updateStatus: async () => {
        updateCalled = true;
      },
    }),
    customerRepository: {},
  });
  await service.handlePayosWebhook({ orderCode: 1 }, {});
  assert.equal(updateCalled, false);
});

// ─── Xu ly dau muc "Khong dat" (xem ensureNgDecision.js) ────────────────────
// Dau muc chi can KIEM TRA nhung tho phat hien phai THAY -> co van hoi khach,
// khach dong y thi phu tung duoc chen thang vao phieu.

const ngOrder = {
  id: 70,
  code: 'RO-2026-070',
  branchId: 1,
  status: 'inprogress',
  tasks: [
    { id: 500, taskName: 'Ga lạnh hệ thống điều hòa', checkResult: 'NG', ngDecision: 'pending' },
    { id: 501, taskName: 'Lọc gió điều hòa', checkResult: 'OK', ngDecision: null },
  ],
};

test('decideNgTask: khach tu choi thi bat buoc ghi ly do', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({ findById: async () => ({ ...ngOrder }) }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.decideNgTask(70, 500, { decision: 'declined', note: '  ', userId: 9, branchId: 1 }),
    (err) => err.statusCode === 400 && /phải ghi rõ lý do/.test(err.message),
  );
});

test('decideNgTask: chan quyet dinh khong hop le va dau muc khong phai NG', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({ findById: async () => ({ ...ngOrder }) }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.decideNgTask(70, 500, { decision: 'maybe', userId: 9, branchId: 1 }),
    (err) => err.statusCode === 400,
  );
  await assert.rejects(
    () => service.decideNgTask(70, 501, { decision: 'accepted', userId: 9, branchId: 1 }),
    (err) => err.statusCode === 400 && /không bị đánh Không đạt/.test(err.message),
  );
});

test('decideNgTask: chan chi nhanh khac', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({ findById: async () => ({ ...ngOrder }) }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.decideNgTask(70, 500, { decision: 'accepted', userId: 9, branchId: 2 }),
    (err) => err.statusCode === 403,
  );
});

// Phieu da chot tien roi thi khong duoc chen them phu tung - se lech voi QR
// PayOS/hoa don da phat.
test('decideNgTask: khong them phu tung khi phieu da chot tien', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ ...ngOrder, status: 'waiting_payment' }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.decideNgTask(70, 500, { decision: 'accepted', userId: 9, branchId: 1 }),
    (err) => err.statusCode === 409 && /đã chốt tiền/.test(err.message),
  );
});

test('decideNgTask: khach dong y thi chen phu tung va tra ve danh sach da them', async () => {
  let goiVoi = null;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ ...ngOrder }),
      acceptNgTaskAndAddParts: async (id, taskId, opts) => {
        goiVoi = { id, taskId, opts };
        return { ok: true, added: [{ name: 'Ga lạnh điều hòa (khi thiếu)', quantity: 1, unit: 'Bình', unitPrice: 900 }] };
      },
    }),
    customerRepository: {},
  });
  const kq = await service.decideNgTask(70, 500, { decision: 'accepted', note: 'khách ok', userId: 9, branchId: 1 });
  assert.equal(goiVoi.taskId, 500);
  assert.equal(goiVoi.opts.note, 'khách ok');
  assert.equal(kq.ngAddedParts.length, 1);
  assert.equal(kq.ngAddedParts[0].name, 'Ga lạnh điều hòa (khi thiếu)');
});

test('decideNgTask: khach tu choi thi KHONG chen phu tung', async () => {
  let daChen = false;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ ...ngOrder }),
      acceptNgTaskAndAddParts: async () => { daChen = true; return { ok: true, added: [] }; },
      setNgDecision: async () => true,
    }),
    customerRepository: {},
  });
  const kq = await service.decideNgTask(70, 500, { decision: 'declined', note: 'khách hẹn lần sau', userId: 9, branchId: 1 });
  assert.equal(daChen, false);
  assert.equal(kq.ngAddedParts.length, 0);
});

// ─── Ma QR PayOS chi duoc thanh toan 1 lan ─────────────────────────────────
// Moi lan bam "Tao ma QR" truoc day la sinh them 1 link PayOS moi ma khong
// dong link cu - tren DB that co 13 phieu cong don nhieu ma, 1 phieu toi 12.
// Moi ma la 1 duong thu tien: khach quet nham ma cu la tien van di trong khi
// phieu da xuat hoa don theo ma khac.

const phieuChoThanhToan = {
  id: 90, code: 'RO-2026-090', branchId: 1, status: 'waiting_payment',
  total: 1000000, customer: { fullName: 'Nguyễn Văn A' },
};

test('khong tao ma QR moi cho phieu da thanh toan qua QR', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ ...phieuChoThanhToan }),
      hasPaidPayosTransaction: async () => true,
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.createPayosPaymentLink(90),
    (err) => err.statusCode === 409 && /đã được thanh toán qua QR/.test(err.message),
  );
});

test('khong tao ma QR khi phieu chua o trang thai cho thanh toan', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findById: async () => ({ ...phieuChoThanhToan, status: 'inprogress' }),
    }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.createPayosPaymentLink(90),
    (err) => err.statusCode === 409 && /chờ thanh toán/.test(err.message),
  );
});

test('_huyCacMaQrCu danh dau huy MOI ma con song cua phieu', async () => {
  const daHuy = [];
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findPendingPayosTransactions: async () => ([
        { order_code: 111, payment_link_id: 'a' },
        { order_code: 222, payment_link_id: 'b' },
      ]),
      markPayosTransactionCancelled: async (code) => { daHuy.push(code); },
    }),
    customerRepository: {},
  });
  // PayOS that se nem loi (khong co cau hinh trong test) - ham phai nuot loi
  // do va VAN danh dau huy o DB, neu khong thi DB con "pending" vinh vien.
  const n = await service._huyCacMaQrCu(90);
  assert.equal(n, 2);
  assert.deepEqual(daHuy, [111, 222]);
});

test('_huyCacMaQrCu bo qua dung ma vua duoc thanh toan', async () => {
  let hoiVoi = null;
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({
      findPendingPayosTransactions: async (id, opts) => { hoiVoi = { id, opts }; return []; },
    }),
    customerRepository: {},
  });
  await service._huyCacMaQrCu(90, { exceptOrderCode: 777 });
  assert.equal(hoiVoi.id, 90);
  assert.equal(hoiVoi.opts.exceptOrderCode, 777);
});

// ─── Chi dinh to truong luc tao phieu ──────────────────────────────────────
// Bo trong = moi to truong deu thay (hanh vi cu). Chi dinh 1 id la bat buoc
// phai kiem: khong thi ai goi thang API co the truyen id bat ky, phieu bien
// mat khoi bang cua MOI to truong ma khong ai hieu tai sao.

test('chi dinh to truong khong thuoc chi nhanh -> tu choi', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.create(
      basePayload({ assignedTeamLeaderId: 999 }),
      { branchId: 1, advisorId: 4 },
    ),
    (err) => err.statusCode === 400 && /không thuộc chi nhánh này/.test(err.message),
  );
});

// ─── Kiem so km va do dai chu o BE ─────────────────────────────────────────
// FE co chan so km (vien do, khoa nut Luu, xoa o khi roi khoi o), nhung goi
// thang API thi FE khong con la cai chan nao ca. Km sai keo theo sai lich
// nhac bao duong va viec tinh con han bao hanh.

test('create: chan so km khong hop le', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(), customerRepository: {},
  });
  const ctx = { branchId: 1, advisorId: 4 };
  const truong = [
    ['abc', /phải là số nguyên/],
    [12.5, /phải là số nguyên/],
    [-100, /không được là số âm/],
    [9999999, /vượt quá mức hợp lý/],
  ];
  for (const [km, mong] of truong) {
    await assert.rejects(
      () => service.create(basePayload({ currentKm: km }), ctx),
      (err) => err.statusCode === 400 && mong.test(err.message),
      `km=${km} le ra phai bi tu choi`,
    );
  }
});

// Cong-to-met chi tang, khong chay lui.
test('create: chan so km nho hon lan ghi nhan gan nhat cua xe', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos({ getVehicleCurrentKm: async () => 50000 }),
    customerRepository: {},
  });
  await assert.rejects(
    () => service.create(basePayload({ currentKm: 45000 }), { branchId: 1, advisorId: 4 }),
    (err) => err.statusCode === 400 && /không được nhỏ hơn/.test(err.message),
  );
  // Bang hoac lon hon thi cho qua
  const ok = await service.create(basePayload({ currentKm: 50000 }), { branchId: 1, advisorId: 4 });
  assert.ok(ok.id);
});

test('create: chan mo ta / ghi chu qua dai', async () => {
  const service = new RepairSettlementService({
    repairSettlementRepository: mockRepos(), customerRepository: {},
  });
  const ctx = { branchId: 1, advisorId: 4 };
  await assert.rejects(
    () => service.create(basePayload({ customerRequest: 'a'.repeat(1001) }), ctx),
    (err) => err.statusCode === 400 && /Mô tả yêu cầu.*quá dài/.test(err.message),
  );
  await assert.rejects(
    () => service.create(basePayload({ note: 'b'.repeat(1001) }), ctx),
    (err) => err.statusCode === 400 && /Ghi chú quá dài/.test(err.message),
  );
});
