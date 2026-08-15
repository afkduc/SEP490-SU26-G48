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
  tasks: [
    { id: 500, taskType: 'service', isDone: false, isCancelled: false, taskName: 'Thay dau' },
    { id: 501, taskType: 'product', isDone: false, isCancelled: false, taskName: 'Loc dau' },
  ],
};

test('getAll returns DTO list for team leader filters', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findAll: async (filters) => {
        assert.equal(filters.branchId, 1);
        assert.equal(filters.teamLeaderId, 8);
        return [{ ...inProgressOrder }];
      },
    }),
  });
  const items = await service.getAll({ branchId: 1, teamLeaderId: 8 });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 70);
});

test('getById 404 when missing', async () => {
  const service = new RepairOrderService({ repairOrderRepository: mockRepo() });
  await assert.rejects(
    () => service.getById(999),
    (err) => err.statusCode === 404,
  );
});

test('getById returns DTO', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      findById: async () => ({ ...inProgressOrder }),
    }),
  });
  const dto = await service.getById(70);
  assert.equal(dto.id, 70);
  assert.equal(dto.status, 'inprogress');
});

test('searchTechnicians maps sameTeam and busy flags', async () => {
  const service = new RepairOrderService({
    repairOrderRepository: mockRepo({
      searchTechnicians: async (tlId, branchId, search) => {
        assert.equal(tlId, 8);
        assert.equal(branchId, 1);
        assert.equal(search, 'An');
        return [
          { id: 101, user_name: 'Tho An', phone: '090', same_team: 1, busy: 0 },
          { id: 102, user_name: 'Tho Binh', phone: '091', same_team: 0, busy: 1 },
        ];
      },
    }),
  });
  const rows = await service.searchTechnicians(8, 1, 'An');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fullName, 'Tho An');
  assert.equal(rows[0].sameTeam, true);
  assert.equal(rows[1].busy, true);
});
