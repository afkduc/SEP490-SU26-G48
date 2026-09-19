const { test } = require('@jest/globals');
const assert = require('node:assert/strict');

// SDK PayOS that doi chu ky hop le tren body webhook - gia lap nhu cac test
// PayOS khac (xem RepairSettlementService.spec.js).
jest.mock('@payos/node', () => ({
  PayOS: class PayOS {
    paymentRequests = { create: async () => ({}), cancel: async () => ({}) };
    webhooks = { verify: async (raw) => ({ orderCode: (raw && raw.orderCode) || 123456 }) };
  },
}));

const RepairSettlementService = require('../../src/application/services/RepairSettlementService');

// Phieu quyet toan phai co IT NHAT 2 nguoi ky. Chia 2 moc vi phieu khong di
// cung 1 co van tu dau den cuoi: nguoi lap phieu hom tiep nhan xe co the khac
// nguoi chot phieu hom khach den nhan xe.
//
//   Moc 1 (lap phieu): khach duyet bao gia + co van lap phieu ky
//   Moc 2 (giao xe)  : co van CHOT phieu ky + khach ky nhan xe
//
// Xem ensureSettlementSignatures.js.

const KY = 'data:image/png;base64,iVBORw0KGgo=';

function repo(overrides = {}) {
  return {
    findById: async () => null,
    saveClosingSignature: async () => true,
    hasPaidPayosTransaction: async () => false,
    findPendingPayosTransactions: async () => [],
    markPayosTransactionCancelled: async () => {},
    updateStatus: async (id, status) => ({ id, status, paymentMethod: 'CASH' }),
    ...overrides,
  };
}

function svc(overrides = {}) {
  return new RepairSettlementService({
    repairSettlementRepository: repo(overrides),
    customerRepository: {},
  });
}

const choThanhToan = { id: 50, code: 'RO-2026-050', status: 'waiting_payment', branchId: 1, tasks: [], total: 972000, customer: { fullName: 'A' } };
const daKy = {
  closingAdvisorId: 9,
  closingSignatureData: KY,
  customerFinalSignatureData: KY,
  customerFinalSignerName: 'Nguyễn Minh Tâm',
};

test('ky quyet toan: thieu chu ky co van / khach / ten nguoi nhan xe deu bi chan', async () => {
  const service = svc({ findById: async () => ({ ...choThanhToan }) });
  const day = { advisorId: 9, advisorSignatureData: KY, customerSignatureData: KY, customerSignerName: 'Nguyễn Minh Tâm' };

  await assert.rejects(
    () => service.saveClosingSignature(50, { ...day, advisorSignatureData: null }),
    (err) => err.statusCode === 400 && /Cố vấn dịch vụ phải ký/.test(err.message),
  );
  await assert.rejects(
    () => service.saveClosingSignature(50, { ...day, customerSignatureData: 'khong-phai-anh' }),
    (err) => err.statusCode === 400 && /khách hàng ký/.test(err.message),
  );
  await assert.rejects(
    () => service.saveClosingSignature(50, { ...day, customerSignerName: '   ' }),
    (err) => err.statusCode === 400 && /tên người nhận xe/i.test(err.message),
  );
});

test('ky quyet toan: chi ky khi phieu dang cho thanh toan, va ghi lai NGUOI CHOT', async () => {
  let saved = null;
  const service = svc({
    findById: async () => ({ ...choThanhToan }),
    saveClosingSignature: async (id, data) => { saved = { id, ...data }; return true; },
  });
  await service.saveClosingSignature(50, {
    advisorId: 9, advisorSignatureData: KY, customerSignatureData: KY, customerSignerName: '  Nguyễn Minh Tâm  ',
  });
  // advisorId = nguoi dang dang nhap (co the khac nguoi lap phieu) -> day la
  // can cu tra loi "phieu nay co van nao done".
  assert.equal(saved.advisorId, 9);
  assert.equal(saved.customerSignerName, 'Nguyễn Minh Tâm');

  const dangSua = svc({ findById: async () => ({ ...choThanhToan, status: 'inprogress' }) });
  await assert.rejects(
    () => dangSua.saveClosingSignature(50, { advisorId: 9, advisorSignatureData: KY, customerSignatureData: KY, customerSignerName: 'A' }),
    (err) => err.statusCode === 409 && /chờ thanh toán/.test(err.message),
  );
});

test('chua ky quyet toan thi khong xuat hoa don va khong tao duoc ma QR', async () => {
  const chuaKy = svc({ findById: async () => ({ ...choThanhToan }) });
  await assert.rejects(
    () => chuaKy.updateStatus(50, 'invoiced', { issuedBy: 9 }),
    (err) => err.statusCode === 409 && /chữ ký quyết toán/.test(err.message),
  );
  await assert.rejects(
    () => chuaKy.createPayosPaymentLink(50, {}),
    (err) => err.statusCode === 409 && /chữ ký quyết toán/.test(err.message),
  );

  // Ky day du roi thi thu tien mat duoc binh thuong.
  const roiKy = svc({ findById: async () => ({ ...choThanhToan, ...daKy }) });
  const dto = await roiKy.updateStatus(50, 'invoiced', { issuedBy: 9 });
  assert.equal(dto.status, 'invoiced');
});

test('webhook PayOS ghi issued_by = co van CHOT phieu, khong phai nguoi lap', async () => {
  let issuedByGhiNhan = null;
  const service = svc({
    findPayosTransactionByOrderCode: async () => ({ id: 1, repair_order_id: 50, status: 'pending' }),
    markPayosTransactionPaid: async () => {},
    // nguoi lap phieu la 4, nguoi chot phieu la 9
    findById: async () => ({ ...choThanhToan, advisorId: 4, ...daKy }),
    updateStatus: async (id, status, opts) => { issuedByGhiNhan = opts.issuedBy; return { id, status }; },
  });
  await service.handlePayosWebhook({ orderCode: 123 }, {});
  assert.equal(issuedByGhiNhan, 9);
});
