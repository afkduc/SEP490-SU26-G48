const { test } = require('@jest/globals');
const assert = require('node:assert/strict');

jest.mock('@payos/node', () => ({
  PayOS: class PayOS {
    paymentRequests = { create: async () => ({}), cancel: async () => ({}) };
    webhooks = { verify: async () => ({}) };
  },
}));

const RepairSettlementService = require('../../src/application/services/RepairSettlementService');

// Phieu co van CHI DINH RIENG cho 1 to truong thi to truong khac khong duoc
// thay va khong nhan duoc. To truong duoc chi dinh co 2 lua chon: nhan, hoac
// TU CHOI kem ly do - tu choi xong phieu quay ve tay co van de doi nguoi khac
// hoac day lai cho tat ca. Xem ensureAssignmentDecline.js.

const CHO_SUA = {
  id: 7, code: 'RO-2026-007', status: 'waiting_repair', branchId: 1,
  advisorId: 4, assignedTeamLeaderId: 18, tasks: [],
};

function svc(overrides = {}) {
  return new RepairSettlementService({
    repairSettlementRepository: {
      findById: async () => ({ ...CHO_SUA }),
      declineAssignment: async () => true,
      reassignTeamLeader: async () => true,
      findBranchTeamLeaders: async () => ([{ id: 18, name: 'Trần Quốc Bảo' }, { id: 29, name: 'Nguyễn Đình Khương' }]),
      ...overrides,
    },
    customerRepository: {},
  });
}

test('danh sach: forTeamLeaderId duoc truyen xuong repository (truoc day bi roi)', async () => {
  let locFindAll = null;
  let locCount = null;
  const service = new RepairSettlementService({
    repairSettlementRepository: {
      findAll: async (loc) => { locFindAll = loc; return []; },
      count: async (loc) => { locCount = loc; return 0; },
    },
    customerRepository: {},
  });
  await service.getAll({ branchId: 1, status: 'waiting_repair', forTeamLeaderId: 18, page: 1, limit: 20 });
  assert.equal(locFindAll.forTeamLeaderId, 18);
  // count PHAI cung bo loc, khong thi tong so lech han danh sach hien ra.
  assert.equal(locCount.forTeamLeaderId, 18);
});

test('tu choi: chi to truong DUOC CHI DINH moi tu choi duoc, va phai co ly do', async () => {
  await assert.rejects(
    () => svc().declineAssignment(7, { teamLeaderId: 29, reason: 'Tổ kín xe' }),
    (err) => err.statusCode === 403 && /không được chỉ định cho bạn/.test(err.message),
  );
  await assert.rejects(
    () => svc().declineAssignment(7, { teamLeaderId: 18, reason: '   ' }),
    (err) => err.statusCode === 400 && /lý do/i.test(err.message),
  );
  await assert.rejects(
    () => svc({ findById: async () => ({ ...CHO_SUA, status: 'inprogress' }) })
      .declineAssignment(7, { teamLeaderId: 18, reason: 'Tổ kín xe' }),
    (err) => err.statusCode === 409 && /đã được nhận/.test(err.message),
  );
});

test('tu choi: ly do duoc chuan hoa khoang trang truoc khi luu', async () => {
  let daLuu = null;
  const service = svc({
    declineAssignment: async (id, data) => { daLuu = { id, ...data }; return true; },
  });
  await service.declineAssignment(7, { teamLeaderId: 18, reason: '  Tổ   kín xe đến hết ca  ' });
  assert.equal(daLuu.teamLeaderId, 18);
  assert.equal(daLuu.reason, 'Tổ kín xe đến hết ca');
});

test('giao lai: chi nhan to truong cung chi nhanh, null = day cho tat ca', async () => {
  let daGiao = 'chua-goi';
  const service = svc({
    reassignTeamLeader: async (id, teamLeaderId) => { daGiao = teamLeaderId; return true; },
  });

  await service.reassignTeamLeader(7, { teamLeaderId: 29, branchId: 1 });
  assert.equal(daGiao, 29);

  await service.reassignTeamLeader(7, { teamLeaderId: null, branchId: 1 });
  assert.equal(daGiao, null);

  await assert.rejects(
    () => service.reassignTeamLeader(7, { teamLeaderId: 999, branchId: 1 }),
    (err) => err.statusCode === 400 && /không thuộc chi nhánh/.test(err.message),
  );
});

test('giao lai: phieu da co nguoi nhan thi khong doi duoc nua', async () => {
  await assert.rejects(
    () => svc({ findById: async () => ({ ...CHO_SUA, status: 'inprogress' }) })
      .reassignTeamLeader(7, { teamLeaderId: 29, branchId: 1 }),
    (err) => err.statusCode === 409 && /còn đang chờ sửa chữa/.test(err.message),
  );
});
