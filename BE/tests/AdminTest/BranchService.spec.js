const { test } = require('@jest/globals');
const assert = require('node:assert/strict');

// Tránh create/deactivate/reactivate gọi auditHelper → SQL thật khi chạy unit test
jest.mock('../../src/utils/auditHelper', () => ({
  auditCrud: {
    create: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null)
  }
}));
const BranchService = require('../../src/application/services/BranchService');
function mockBranchRepo(overrides = {}) {
  return {
    findAll: async () => [],
    findById: async id => id === 1 ? {
      id: 1,
      branchCode: 'HN',
      isActive: true
    } : null,
    findByCode: async () => null,
    create: async data => 10,
    update: async (id, data) => ({
      id,
      ...data
    }),
    setActive: async (id, active) => ({
      id,
      isActive: active
    }),
    findManagerCandidates: async () => [],
    findUnassignedManagers: async () => [],
    getBranchStats: async () => ({}),
    ...overrides
  };
}
test('BranchService.list shows all branches', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findAll: async () => [{ id: 1, branchCode: 'HN01', branchName: 'AutoGara Hà Nội', isActive: true }]
    })
  });
  assert.deepEqual(await service.list(), [{
    id: 1, branchCode: 'HN01', branchName: 'AutoGara Hà Nội', isActive: true
  }]);
});
test('BranchService.list shows no branch for a missing keyword', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo({ findAll: async () => [] }) });
  assert.deepEqual(await service.list(), []);
});
test("BranchService.getById shows branch detail and statistics - case 01", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      getBranchStats: async () => ({
        employeeCount: 5
      })
    })
  });
  assert.equal((await service.getById(1)).branchCode, 'HN');
});
test("BranchService.getById shows branch detail and statistics - case 02", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      getBranchStats: async () => ({
        employeeCount: 5
      })
    })
  });
  assert.deepEqual(await service.getStats(1), {
    employeeCount: 5
  });
});
test("BranchService.update changes visible branch fields and reports missing branches - case 01", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  const updated = await service.update(1, {
    branchName: 'Chi nhánh Hà Nội',
    phone: '090-123-4567'
  }, {});
  assert.equal(updated.branchName, 'Chi nhánh Hà Nội');
});
test("BranchService.update changes visible branch fields and reports missing branches - case 02", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  const updated = await service.update(1, {
    branchName: 'Chi nhánh Hà Nội',
    phone: '090-123-4567'
  }, {});
  assert.equal(updated.phone, '0901234567');
});
test("BranchService.update changes visible branch fields and reports missing branches - case 03", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  const updated = await service.update(1, {
    branchName: 'Chi nhánh Hà Nội',
    phone: '090-123-4567'
  }, {});
  await assert.rejects(() => service.update(999, {
    branchName: 'Chi nhánh khác'
  }, {}), err => err.statusCode === 404);
});
test('BranchService.update rejects a blank branch name', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(() => service.update(1, { branchName: '' }, {}), err => err.statusCode === 400);
});
test('BranchService.update rejects an invalid phone', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(() => service.update(1, { branchName: 'AutoGara Hà Nội', phone: '123' }, {}), err => err.statusCode === 400);
});
test('BranchService.update rejects an invalid email', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(() => service.update(1, { branchName: 'AutoGara Hà Nội', email: 'abc' }, {}), err => err.statusCode === 400);
});
test("Branch Catalog - 10\u201311: blank branch name and code rejected - case 01", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.create({
    branchCode: 'HN01',
    branchName: ''
  }), err => err.statusCode === 400 && /Tên chi nhánh là bắt buộc/.test(err.message));
});
test("Branch Catalog - 10\u201311: blank branch name and code rejected - case 02", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.create({
    branchCode: '',
    branchName: 'AutoGara Hà Nội'
  }), err => err.statusCode === 400 && err.message === 'Mã chi nhánh là bắt buộc');
});
test('Branch Catalog - 12: branch code max 20 characters', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.create({
    branchCode: 'A'.repeat(21),
    branchName: 'Test Branch'
  }), err => err.statusCode === 400 && err.message === 'Mã chi nhánh tối đa 20 ký tự');
});
test('Branch Catalog - 13: duplicate branch code rejected', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findByCode: async () => ({
        id: 2
      })
    })
  });
  await assert.rejects(() => service.create({
    branchCode: 'HN01',
    branchName: 'AutoGara Hà Nội'
  }), err => err.statusCode === 409 && err.message === 'Mã chi nhánh đã tồn tại');
});
test("Branch Catalog - 14\u201316: invalid phone and email rejected - case 01", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.create({
    branchCode: 'HN02',
    branchName: 'AutoGara HCM',
    phone: '12345'
  }), err => err.statusCode === 400 && /Số điện thoại/.test(err.message));
});
test("Branch Catalog - 14\u201316: invalid phone and email rejected - case 02", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.create({
    branchCode: 'HN03',
    branchName: 'AutoGara ĐN',
    email: 'bad@mail.v'
  }), err => err.statusCode === 400 && /Email chỉ chấp nhận/.test(err.message));
});
test("Branch Catalog - 15/18: create branch with valid data normalizes phone - case 01", async () => {
  let saved;
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      create: async data => {
        saved = data;
        return 11;
      },
      findById: async () => ({
        id: 11,
        branchCode: 'HN04',
        branchName: 'Test'
      })
    })
  });
  const branch = await service.create({
    branchCode: 'HN04',
    branchName: 'AutoGara Test',
    phone: '090-123-4567',
    email: 'branch@mail.com'
  }, {});
  assert.equal(saved.phone, '0901234567');
});
test("Branch Catalog - 15/18: create branch with valid data normalizes phone - case 02", async () => {
  let saved;
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      create: async data => {
        saved = data;
        return 11;
      },
      findById: async () => ({
        id: 11,
        branchCode: 'HN04',
        branchName: 'Test'
      })
    })
  });
  const branch = await service.create({
    branchCode: 'HN04',
    branchName: 'AutoGara Test',
    phone: '090-123-4567',
    email: 'branch@mail.com'
  }, {});
  assert.equal(branch.id, 11);
});
test("Branch Catalog - 7/8: deactivate and reactivate - case 01", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findById: async () => ({
        id: 1,
        branchCode: 'HN',
        branchName: 'Hà Nội',
        isActive: true
      }),
      setActive: async (id, active) => ({
        id,
        isActive: active
      })
    })
  });
  const off = await service.deactivate(1, {});
  const on = await service.reactivate(1, {});
  assert.equal(off.isActive, false);
});
test("Branch Catalog - 7/8: deactivate and reactivate - case 02", async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findById: async () => ({
        id: 1,
        branchCode: 'HN',
        branchName: 'Hà Nội',
        isActive: true
      }),
      setActive: async (id, active) => ({
        id,
        isActive: active
      })
    })
  });
  const off = await service.deactivate(1, {});
  const on = await service.reactivate(1, {});
  assert.equal(on.isActive, true);
});
test('getById returns 404 for missing branch', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo()
  });
  await assert.rejects(() => service.getById(99999), err => (
    err.statusCode === 404 && err.message === 'Chi nhánh không tồn tại'
  ));
});
test('deactivate reports a missing branch', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(() => service.deactivate(99999, {}), err => err.statusCode === 404);
});
test('reactivate reports a missing branch', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(() => service.reactivate(99999, {}), err => err.statusCode === 404);
});

test('Tạo chi nhánh với đầy đủ dữ liệu trên biểu mẫu', async () => {
  let saved;
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      create: async data => {
        saved = data;
        return 1;
      },
      findById: async () => ({ id: 1, ...saved })
    })
  });
  const branch = await service.create({
    branchCode: 'HN01',
    branchName: 'AutoGara Hà Nội',
    address: 'Hà Nội',
    phone: '0912345678',
    email: 'hanoi@autogara.com',
    managerId: 1
  }, {});
  assert.deepEqual(branch, {
    id: 1,
    branchCode: 'HN01',
    branchName: 'AutoGara Hà Nội',
    address: 'Hà Nội',
    phone: '0912345678',
    email: 'hanoi@autogara.com',
    managerId: 1
  });
});

test('Cập nhật đầy đủ dữ liệu chi nhánh', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  const branch = await service.update(1, {
    branchName: 'AutoGara Hà Nội',
    address: 'Hà Nội',
    phone: '0912345678',
    email: 'hanoi@autogara.com',
    managerId: 1
  }, {});
  assert.deepEqual(branch, {
    id: 1,
    branchName: 'AutoGara Hà Nội',
    address: 'Hà Nội',
    phone: '0912345678',
    email: 'hanoi@autogara.com',
    managerId: 1
  });
});
