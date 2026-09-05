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
