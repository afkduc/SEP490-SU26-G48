const test = require('node:test');
const assert = require('node:assert/strict');
const VehicleBayService = require('../../src/application/services/VehicleBayService');

test('listMine returns bays for team leader', async () => {
  const service = new VehicleBayService({
    vehicleBayRepository: {
      findByTeamLeader: async (tlId) => {
        assert.equal(tlId, 8);
        return [
          { id: 1, bayNumber: 1, teamLeaderId: 8 },
          { id: 2, bayNumber: 2, teamLeaderId: 8 },
          { id: 3, bayNumber: 3, teamLeaderId: 8 },
        ];
      },
      findByBranch: async () => [],
    },
  });
  const bays = await service.listMine(8);
  assert.equal(bays.length, 3);
});

test('listMine returns empty array when TL has no bays', async () => {
  const service = new VehicleBayService({
    vehicleBayRepository: {
      findByTeamLeader: async () => [],
      findByBranch: async () => [],
    },
  });
  const bays = await service.listMine(8);
  assert.deepEqual(bays, []);
});

test('listByBranch returns all branch bays for advisor view', async () => {
  const service = new VehicleBayService({
    vehicleBayRepository: {
      findByTeamLeader: async () => [],
      findByBranch: async (branchId) => {
        assert.equal(branchId, 1);
        return [{ id: 1, bayNumber: 1, branchId: 1 }];
      },
    },
  });
  const bays = await service.listByBranch(1);
  assert.equal(bays.length, 1);
});
