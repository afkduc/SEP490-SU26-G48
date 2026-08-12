const test = require('node:test');
const assert = require('node:assert/strict');

require.cache[require.resolve('../../src/infrastructure/repositories/BranchRepositoryImpl')] = {
  id: require.resolve('../../src/infrastructure/repositories/BranchRepositoryImpl'),
  filename: 'BranchRepositoryImpl.js',
  loaded: true,
  exports: class MockBranchRepository {
    async findById(id) {
      if (Number(id) === 2) {
        return { id: 2, branchCode: 'HN', isActive: true };
      }
      return null;
    }

    async setActive(id, isActive) {
      return { id: Number(id), isActive };
    }
  },
};

const GeneralDirectorService = require('../../src/application/services/GeneralDirectorService');

function mockRepo(overrides = {}) {
  return {
    getRevenueReports: async () => [{ id: 1, totalRevenue: 100 }],
    listSettlementReports: async () => [{ id: 1, status: 'approved' }],
    getSettlementReportById: async () => ({ id: 1, status: 'approved' }),
    listBranches: async () => [{ id: 1, branchName: 'Chi nhánh Hà Nội' }],
    listEmployees: async () => [{ id: 1, fullName: 'NV 1' }],
    getEmployeeById: async () => ({ id: 1, fullName: 'NV 1' }),
    listTechnicians: async () => [{ id: 1, fullName: 'KT 1' }],
    getTechnicianById: async () => ({ id: 1, fullName: 'KT 1' }),
    listBranchManagers: async () => [{ id: 1, fullName: 'QL 1' }],
    getBranchManagerById: async () => ({ id: 1, fullName: 'QL 1' }),
    createBranchManager: async (data) => ({ id: 99, ...data }),
    updateBranchManager: async (id, data) => ({ id, ...data }),
    ...overrides,
  };
}

// --- Revenue reports ---

test('GeneralDirectorService.getRevenueReports rejects invalid monthsBack', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.getRevenueReports({ monthsBack: 2 }),
    (err) => err.statusCode === 400 && /monthsBack/.test(err.message),
  );

  await assert.rejects(
    () => service.getRevenueReports({ monthsBack: 25 }),
    (err) => err.statusCode === 400 && /monthsBack/.test(err.message),
  );
});

test('GeneralDirectorService.getRevenueReports normalizes input and delegates to repository', async () => {
  const calls = [];
  const service = new GeneralDirectorService(
    mockRepo({
      getRevenueReports: async (filters) => {
        calls.push(filters);
        return [{ id: 1, totalRevenue: 1200 }];
      },
    }),
  );

  const result = await service.getRevenueReports({ branchId: 5, monthsBack: '12' });

  assert.deepEqual(result, [{ id: 1, totalRevenue: 1200 }]);
  assert.deepEqual(calls[0], { branchId: 5, monthsBack: 12 });
});

// --- Settlement reports ---

test('GeneralDirectorService.getSettlementReportById rejects missing id and missing report', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.getSettlementReportById(),
    (err) => err.statusCode === 400 && /Thiếu/.test(err.message),
  );

  const missingService = new GeneralDirectorService(
    mockRepo({
      getSettlementReportById: async () => null,
    }),
  );

  await assert.rejects(
    () => missingService.getSettlementReportById(999),
    (err) => err.statusCode === 404 && /Không tìm thấy/.test(err.message),
  );
});

// --- Employees and technicians ---

test('GeneralDirectorService.listEmployees validates status and returns repository results', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.listEmployees({ status: 'pending' }),
    (err) => err.statusCode === 400 && /Trạng thái/.test(err.message),
  );

  const result = await service.listEmployees({ search: 'Nguyen', branchId: 2, status: 'active', role: 'manager' });
  assert.deepEqual(result, [{ id: 1, fullName: 'NV 1' }]);
});

test('GeneralDirectorService.getEmployeeById rejects missing or unknown employee', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.getEmployeeById(),
    (err) => err.statusCode === 400 && /Thiếu/.test(err.message),
  );

  const missingService = new GeneralDirectorService(
    mockRepo({
      getEmployeeById: async () => null,
    }),
  );

  await assert.rejects(
    () => missingService.getEmployeeById(999),
    (err) => err.statusCode === 404 && /Không tìm thấy/.test(err.message),
  );
});

test('GeneralDirectorService.listTechnicians validates status and skillGroup', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.listTechnicians({ status: 'pending' }),
    (err) => err.statusCode === 400 && /Trạng thái/.test(err.message),
  );

  await assert.rejects(
    () => service.listTechnicians({ skillGroup: 'invalid-group' }),
    (err) => err.statusCode === 400 && /Nhóm kỹ năng/.test(err.message),
  );

  const result = await service.listTechnicians({ skillGroup: 'electrical', status: 'active' });
  assert.deepEqual(result, [{ id: 1, fullName: 'KT 1' }]);
});

test('GeneralDirectorService.getTechnicianById rejects missing/unknown technician', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.getTechnicianById(),
    (err) => err.statusCode === 400 && /Thiếu/.test(err.message),
  );

  const missingService = new GeneralDirectorService(
    mockRepo({
      getTechnicianById: async () => null,
    }),
  );

  await assert.rejects(
    () => missingService.getTechnicianById(777),
    (err) => err.statusCode === 404 && /Không tìm thấy/.test(err.message),
  );
});

// --- Branch managers ---

test('GeneralDirectorService.listBranchManagers validates status and calls repository', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.listBranchManagers({ status: 'unknown' }),
    (err) => err.statusCode === 400 && /Trạng thái/.test(err.message),
  );

  const result = await service.listBranchManagers({ branchId: 3, status: 'active' });
  assert.deepEqual(result, [{ id: 1, fullName: 'QL 1' }]);
});

test('GeneralDirectorService.getBranchManagerById rejects missing or unknown manager', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.getBranchManagerById(),
    (err) => err.statusCode === 400 && /Thiếu/.test(err.message),
  );

  const missingService = new GeneralDirectorService(
    mockRepo({
      getBranchManagerById: async () => null,
    }),
  );

  await assert.rejects(
    () => missingService.getBranchManagerById(888),
    (err) => err.statusCode === 404 && /Không tìm thấy/.test(err.message),
  );
});

// --- Create branch manager ---

test('GeneralDirectorService.createBranchManager validates required fields and data format', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.createBranchManager({ fullName: '', email: 'a@b.com', phone: '0901234567', password: 'Pass1234', branchId: 1 }),
    (err) => err.statusCode === 400 && /Họ tên/.test(err.message),
  );

  await assert.rejects(
    () => service.createBranchManager({ fullName: 'Nguyen', email: 'invalid-email', phone: '0901234567', password: 'Pass1234', branchId: 1 }),
    (err) => err.statusCode === 400 && /Email/.test(err.message),
  );

  await assert.rejects(
    () => service.createBranchManager({ fullName: 'Nguyen', email: 'a@b.com', phone: '12345', password: 'Pass1234', branchId: 1 }),
    (err) => err.statusCode === 400 && /Số điện thoại/.test(err.message),
  );

  await assert.rejects(
    () => service.createBranchManager({ fullName: 'Nguyen', email: 'a@b.com', phone: '0901234567', password: 'short', branchId: 1 }),
    (err) => err.statusCode === 400 && /Mật khẩu/.test(err.message),
  );

  await assert.rejects(
    () => service.createBranchManager({ fullName: 'Nguyen', email: 'a@b.com', phone: '0901234567', password: 'Pass1234', confirmPassword: 'Pass4321', branchId: 1 }),
    (err) => err.statusCode === 400 && /Xác nhận mật khẩu/.test(err.message),
  );
});

test('GeneralDirectorService.createBranchManager succeeds with normalized values', async () => {
  const created = [];
  const service = new GeneralDirectorService(
    mockRepo({
      createBranchManager: async (data) => {
        created.push(data);
        return { id: 77, ...data };
      },
    }),
  );

  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive',
  });

  assert.equal(result.id, 77);
  assert.equal(result.fullName, 'Nguyen Van A');
  assert.equal(result.email, 'nguyenvana@gmail.com');
  assert.equal(result.phone, '0901234567');
  assert.equal(result.branchId, 2);
  assert.equal(result.status, 'inactive');
  assert.notEqual(result.passwordHash, 'Pass1234');
  assert.equal(created[0].passwordHash.length > 10, true);
});

// --- Update branch manager ---

test('GeneralDirectorService.updateBranchManager validates update payload and repository lookup', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.updateBranchManager(),
    (err) => err.statusCode === 400 && /Thiếu mã/.test(err.message),
  );

  await assert.rejects(
    () => service.updateBranchManager(1, { fullName: '', email: 'a@b.com', phone: '0901234567', branchId: 1 }),
    (err) => err.statusCode === 400 && /Họ tên/.test(err.message),
  );

  await assert.rejects(
    () => service.updateBranchManager(1, { fullName: 'Nguyen', email: 'bad-email', phone: '0901234567', branchId: 1 }),
    (err) => err.statusCode === 400 && /Email/.test(err.message),
  );

  const missingService = new GeneralDirectorService(
    mockRepo({
      getBranchManagerById: async () => null,
    }),
  );

  await assert.rejects(
    () => missingService.updateBranchManager(99, { fullName: 'Nguyen', email: 'a@b.com', phone: '0901234567', branchId: 1 }),
    (err) => err.statusCode === 404 && /Không tìm thấy/.test(err.message),
  );
});

test('GeneralDirectorService.updateBranchManager succeeds with normalized data', async () => {
  const service = new GeneralDirectorService(
    mockRepo({
      getBranchManagerById: async () => ({ id: 5, fullName: 'Old Name' }),
      updateBranchManager: async (id, data) => ({ id, ...data }),
    }),
  );

  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active',
  });

  assert.equal(result.id, 5);
  assert.equal(result.fullName, 'Nguyen Van B');
  assert.equal(result.email, 'nguyenvanb@gmail.com');
  assert.equal(result.phone, '0909876543');
  assert.equal(result.branchId, 3);
  assert.equal(result.status, 'active');
});

// --- Branch activation/deactivation ---

test('GeneralDirectorService.deactivateBranch and reactivateBranch validate branch existence', async () => {
  const service = new GeneralDirectorService(mockRepo());

  await assert.rejects(
    () => service.deactivateBranch(999),
    (err) => err.statusCode === 404 && /Chi nhánh/.test(err.message),
  );

  await assert.rejects(
    () => service.reactivateBranch(999),
    (err) => err.statusCode === 404 && /Chi nhánh/.test(err.message),
  );
});

test('GeneralDirectorService.deactivateBranch and reactivateBranch update active status', async () => {
  const service = new GeneralDirectorService(mockRepo());

  const deactivated = await service.deactivateBranch(2);
  assert.deepEqual(deactivated, { id: 2, isActive: false });

  const reactivated = await service.reactivateBranch(2);
  assert.deepEqual(reactivated, { id: 2, isActive: true });
});
