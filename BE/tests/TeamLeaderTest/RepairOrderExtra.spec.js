const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const RepairOrderService = require('../../src/application/services/RepairOrderService');

test('searchTechnicians maps team membership and busy status', async () => {
  const repository = {
    searchTechnicians: async (teamLeaderId, branchId, search) => {
      assert.deepEqual({ teamLeaderId, branchId, search }, { teamLeaderId: 8, branchId: 1, search: 'Nam' });
      return [
        { id: 101, user_name: 'Nguyễn Văn Nam', phone: '0901234567', same_team: 1, busy: 0 },
        { id: 102, user_name: 'Trần Văn Bình', phone: '0907654321', same_team: 0, busy: 1 },
      ];
    },
  };
  const service = new RepairOrderService({ repairOrderRepository: repository });

  const rows = await service.searchTechnicians(8, 1, 'Nam');

  assert.equal(rows[0].fullName, 'Nguyễn Văn Nam');
  assert.equal(rows[0].sameTeam, true);
  assert.equal(rows[0].busy, false);
  assert.equal(rows[1].sameTeam, false);
  assert.equal(rows[1].busy, true);
});
