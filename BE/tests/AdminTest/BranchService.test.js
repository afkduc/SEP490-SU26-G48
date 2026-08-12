const test = require('node:test');
const assert = require('node:assert/strict');

// Tránh create/deactivate/reactivate gọi auditHelper → SQL thật khi chạy unit test
require.cache[require.resolve('../../src/utils/auditHelper')] = {
  id: 'mock-audit-helper',
  filename: 'mock-audit-helper',
  loaded: true,
  exports: {
    auditCrud: {
      create: async () => {},
      update: async () => {},
    },
  },
};

const BranchService = require('../../src/application/services/BranchService');

function mockBranchRepo(overrides = {}) {
  return {
    findAll: async () => [],
    findById: async (id) => (id === 1 ? { id: 1, branchCode: 'HN', isActive: true } : null),
    findByCode: async () => null,
    create: async (data) => 10,
    update: async (id, data) => ({ id, ...data }),
    setActive: async (id, active) => ({ id, isActive: active }),
    findManagerCandidates: async () => [],
    findUnassignedManagers: async () => [],
    getBranchStats: async () => ({}),
    ...overrides,
  };
}

// Report 5.2 — Branch Catalog Management (BE validation paths)

test('Branch Catalog - 10–11: blank branch name and code rejected', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(
    () => service.create({ branchCode: 'HN01', branchName: '' }),
    (err) => err.statusCode === 400 && /Tên chi nhánh là bắt buộc/.test(err.message),
  );
  await assert.rejects(
    () => service.create({ branchCode: '', branchName: 'AutoGara Hà Nội' }),
    (err) => err.statusCode === 400 && /branchCode la bat buoc/.test(err.message),
  );
});

test('Branch Catalog - 12: branch code max 20 characters', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(
    () => service.create({ branchCode: 'A'.repeat(21), branchName: 'Test Branch' }),
    (err) => err.statusCode === 400 && /branchCode toi da 20/.test(err.message),
  );
});

test('Branch Catalog - 13: duplicate branch code rejected', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findByCode: async () => ({ id: 2 }),
    }),
  });
  await assert.rejects(
    () => service.create({ branchCode: 'HN01', branchName: 'AutoGara Hà Nội' }),
    (err) => err.statusCode === 409 && /Ma chi nhanh da ton tai/.test(err.message),
  );
});

test('Branch Catalog - 14–16: invalid phone and email rejected', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(
    () => service.create({
      branchCode: 'HN02',
      branchName: 'AutoGara HCM',
      phone: '12345',
    }),
    (err) => err.statusCode === 400 && /Số điện thoại/.test(err.message),
  );
  await assert.rejects(
    () => service.create({
      branchCode: 'HN03',
      branchName: 'AutoGara ĐN',
      email: 'bad@mail.v',
    }),
    (err) => err.statusCode === 400 && /Email chỉ chấp nhận/.test(err.message),
  );
});

test('Branch Catalog - 15/18: create branch with valid data normalizes phone', async () => {
  let saved;
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      create: async (data) => {
        saved = data;
        return 11;
      },
      findById: async () => ({ id: 11, branchCode: 'HN04', branchName: 'Test' }),
    }),
  });

  const branch = await service.create({
    branchCode: 'HN04',
    branchName: 'AutoGara Test',
    phone: '090-123-4567',
    email: 'branch@mail.com',
  }, {});

  assert.equal(saved.phone, '0901234567');
  assert.equal(branch.id, 11);
});

test('Branch Catalog - 7/8: deactivate and reactivate', async () => {
  const service = new BranchService({
    branchRepository: mockBranchRepo({
      findById: async () => ({ id: 1, branchCode: 'HN', branchName: 'Hà Nội', isActive: true }),
      setActive: async (id, active) => ({ id, isActive: active }),
    }),
  });

  const off = await service.deactivate(1, {});
  assert.equal(off.isActive, false);

  const on = await service.reactivate(1, {});
  assert.equal(on.isActive, true);
});

test('getById returns 404 for missing branch', async () => {
  const service = new BranchService({ branchRepository: mockBranchRepo() });
  await assert.rejects(
    () => service.getById(999),
    (err) => err.statusCode === 404,
  );
});
