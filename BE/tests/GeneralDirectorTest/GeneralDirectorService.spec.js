const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
jest.mock('../../src/infrastructure/repositories/BranchRepositoryImpl', () => class MockBranchRepository {
  async findById(id) {
    if ([1, 2].includes(Number(id))) {
      return {
        id: 2,
        branchCode: 'HN',
        isActive: true
      };
    }
    return null;
  }
  async setActive(id, isActive) {
    return {
      id: Number(id),
      isActive
    };
  }
});
const GeneralDirectorService = require('../../src/application/services/GeneralDirectorService');
function mockRepo(overrides = {}) {
  return {
    getRevenueReports: async () => [{
      id: 1,
      totalRevenue: 100
    }],
    listSettlementReports: async () => [{
      id: 1,
      status: 'approved'
    }],
    getSettlementReportById: async () => ({
      id: 1,
      status: 'approved'
    }),
    listBranches: async () => [{
      id: 1,
      branchName: 'Chi nhánh Hà Nội'
    }],
    listEmployees: async () => [{
      id: 1,
      fullName: 'NV 1'
    }],
    getEmployeeById: async () => ({
      id: 1,
      fullName: 'NV 1'
    }),
    listTechnicians: async () => [{
      id: 1,
      fullName: 'KT 1'
    }],
    getTechnicianById: async () => ({
      id: 1,
      fullName: 'KT 1'
    }),
    listBranchManagers: async () => [{
      id: 1,
      fullName: 'QL 1'
    }],
    getBranchManagerById: async () => ({
      id: 1,
      fullName: 'QL 1'
    }),
    createBranchManager: async data => ({
      id: 99,
      ...data
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    }),
    ...overrides
  };
}

// --- Revenue reports ---

test("GeneralDirectorService.listSettlementReports returns filtered settlement reports - case 01", async () => {
  let filters;
  const service = new GeneralDirectorService(mockRepo({
    listSettlementReports: async value => {
      filters = value;
      return [{
        id: 1
      }];
    }
  }));
  assert.equal((await service.listSettlementReports({
    branchId: 1,
    status: 'invoiced'
  })).length, 1);
});
test("GeneralDirectorService.listSettlementReports returns filtered settlement reports - case 02", async () => {
  let filters;
  const service = new GeneralDirectorService(mockRepo({
    listSettlementReports: async value => {
      filters = value;
      return [{
        id: 1
      }];
    }
  }));
  await service.listSettlementReports({
    branchId: 1,
    status: 'invoiced'
  });
  assert.deepEqual(filters, {
    branchId: 1,
    status: 'invoiced'
  });
});
test("GeneralDirectorService detail screens return existing records - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.equal((await service.getSettlementReportById(1)).id, 1);
});
test("GeneralDirectorService detail screens return existing records - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.equal((await service.getEmployeeById(1)).id, 1);
});
test("GeneralDirectorService detail screens return existing records - case 03", async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.equal((await service.getTechnicianById(1)).id, 1);
});
test("GeneralDirectorService detail screens return existing records - case 04", async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.equal((await service.getBranchManagerById(1)).id, 1);
});
test("GeneralDirectorService.getSettlementReportById rejects missing id and missing report - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getSettlementReportById: async () => null
  }));
  await assert.rejects(() => service.getSettlementReportById(), err => err.statusCode === 400 && /Thiếu/.test(err.message));
});
test("GeneralDirectorService.getSettlementReportById rejects missing id and missing report - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getSettlementReportById: async () => null
  }));
  await assert.rejects(() => missingService.getSettlementReportById(999), err => err.statusCode === 404 && /Không tìm thấy/.test(err.message));
});
test("GeneralDirectorService.listEmployees validates status and returns repository results - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listEmployees({
    search: 'Nguyen',
    branchId: 2,
    status: 'active',
    role: 'manager'
  });
  await assert.rejects(() => service.listEmployees({
    status: 'pending'
  }), err => err.statusCode === 400 && /Trạng thái/.test(err.message));
});
test("GeneralDirectorService.listEmployees validates status and returns repository results - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listEmployees({
    search: 'Nguyen',
    branchId: 2,
    status: 'active',
    role: 'manager'
  });
  assert.deepEqual(result, [{
    id: 1,
    fullName: 'NV 1'
  }]);
});
test("GeneralDirectorService.getEmployeeById rejects missing or unknown employee - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getEmployeeById: async () => null
  }));
  await assert.rejects(() => service.getEmployeeById(), err => err.statusCode === 400 && /Thiếu/.test(err.message));
});
test("GeneralDirectorService.getEmployeeById rejects missing or unknown employee - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getEmployeeById: async () => null
  }));
  await assert.rejects(() => missingService.getEmployeeById(999), err => err.statusCode === 404 && /Không tìm thấy/.test(err.message));
});
test("GeneralDirectorService.listTechnicians validates status and skillGroup - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listTechnicians({
    skillGroup: 'electrical',
    status: 'active'
  });
  await assert.rejects(() => service.listTechnicians({
    status: 'pending'
  }), err => err.statusCode === 400 && /Trạng thái/.test(err.message));
});
test("GeneralDirectorService.listTechnicians validates status and skillGroup - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listTechnicians({
    skillGroup: 'electrical',
    status: 'active'
  });
  await assert.rejects(() => service.listTechnicians({
    skillGroup: 'invalid-group'
  }), err => err.statusCode === 400 && /Nhóm kỹ năng/.test(err.message));
});
test("GeneralDirectorService.listTechnicians validates status and skillGroup - case 03", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listTechnicians({
    skillGroup: 'electrical',
    status: 'active'
  });
  assert.deepEqual(result, [{
    id: 1,
    fullName: 'KT 1'
  }]);
});
test("GeneralDirectorService.getTechnicianById rejects missing/unknown technician - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getTechnicianById: async () => null
  }));
  await assert.rejects(() => service.getTechnicianById(), err => err.statusCode === 400 && /Thiếu/.test(err.message));
});
test("GeneralDirectorService.getTechnicianById rejects missing/unknown technician - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getTechnicianById: async () => null
  }));
  await assert.rejects(() => missingService.getTechnicianById(777), err => err.statusCode === 404 && /Không tìm thấy/.test(err.message));
});
test("GeneralDirectorService.listBranchManagers validates status and calls repository - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listBranchManagers({
    branchId: 3,
    status: 'active'
  });
  await assert.rejects(() => service.listBranchManagers({
    status: 'unknown'
  }), err => err.statusCode === 400 && /Trạng thái/.test(err.message));
});
test("GeneralDirectorService.listBranchManagers validates status and calls repository - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const result = await service.listBranchManagers({
    branchId: 3,
    status: 'active'
  });
  assert.deepEqual(result, [{
    id: 1,
    fullName: 'QL 1'
  }]);
});
test("GeneralDirectorService.getBranchManagerById rejects missing or unknown manager - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => service.getBranchManagerById(), err => err.statusCode === 400 && /Thiếu/.test(err.message));
});
test("GeneralDirectorService.getBranchManagerById rejects missing or unknown manager - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => missingService.getBranchManagerById(888), err => err.statusCode === 404 && /Không tìm thấy/.test(err.message));
});
test("GeneralDirectorService.createBranchManager validates required fields and data format - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.createBranchManager({
    fullName: '',
    email: 'a@b.com',
    phone: '0901234567',
    password: 'Pass1234',
    branchId: 1
  }), err => err.statusCode === 400 && /Họ tên/.test(err.message));
});
test("GeneralDirectorService.createBranchManager validates required fields and data format - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.createBranchManager({
    fullName: 'Nguyen',
    email: 'invalid-email',
    phone: '0901234567',
    password: 'Pass1234',
    branchId: 1
  }), err => err.statusCode === 400 && /Email/.test(err.message));
});
test("GeneralDirectorService.createBranchManager validates required fields and data format - case 03", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.createBranchManager({
    fullName: 'Nguyen',
    email: 'a@b.com',
    phone: '12345',
    password: 'Pass1234',
    branchId: 1
  }), err => err.statusCode === 400 && /Số điện thoại/.test(err.message));
});
test("GeneralDirectorService.createBranchManager validates required fields and data format - case 04", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.createBranchManager({
    fullName: 'Nguyen',
    email: 'a@b.com',
    phone: '0901234567',
    password: 'short',
    branchId: 1
  }), err => err.statusCode === 400 && /Mật khẩu/.test(err.message));
});
test("GeneralDirectorService.createBranchManager validates required fields and data format - case 05", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.createBranchManager({
    fullName: 'Nguyen',
    email: 'a@b.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass4321',
    branchId: 1
  }), err => err.statusCode === 400 && /Xác nhận mật khẩu/.test(err.message));
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 01", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.id, 77);
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 02", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.fullName, 'Nguyen Van A');
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 03", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.email, 'nguyenvana@gmail.com');
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 04", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.phone, '0901234567');
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 05", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.branchId, 2);
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 06", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(result.status, 'inactive');
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 07", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.notEqual(result.passwordHash, 'Pass1234');
});
test("GeneralDirectorService.createBranchManager succeeds with normalized values - case 08", async () => {
  const created = [];
  const service = new GeneralDirectorService(mockRepo({
    createBranchManager: async data => {
      created.push(data);
      return {
        id: 77,
        ...data
      };
    }
  }));
  const result = await service.createBranchManager({
    fullName: ' Nguyen Van A ',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    password: 'Pass1234',
    confirmPassword: 'Pass1234',
    branchId: '2',
    status: 'inactive'
  });
  assert.equal(created[0].passwordHash.length > 10, true);
});
test("GeneralDirectorService.updateBranchManager validates update payload and repository lookup - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => service.updateBranchManager(), err => err.statusCode === 400 && /Thiếu mã/.test(err.message));
});
test("GeneralDirectorService.updateBranchManager validates update payload and repository lookup - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => service.updateBranchManager(1, {
    fullName: '',
    email: 'a@b.com',
    phone: '0901234567',
    branchId: 1
  }), err => err.statusCode === 400 && /Họ tên/.test(err.message));
});
test("GeneralDirectorService.updateBranchManager validates update payload and repository lookup - case 03", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => service.updateBranchManager(1, {
    fullName: 'Nguyen',
    email: 'bad-email',
    phone: '0901234567',
    branchId: 1
  }), err => err.statusCode === 400 && /Email/.test(err.message));
});
test("GeneralDirectorService.updateBranchManager validates update payload and repository lookup - case 04", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const missingService = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => null
  }));
  await assert.rejects(() => missingService.updateBranchManager(99, {
    fullName: 'Nguyen',
    email: 'a@b.com',
    phone: '0901234567',
    branchId: 1
  }), err => err.statusCode === 404 && /Không tìm thấy/.test(err.message));
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.id, 5);
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.fullName, 'Nguyen Van B');
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 03", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.email, 'nguyenvanb@gmail.com');
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 04", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.phone, '0909876543');
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 05", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.branchId, 3);
});
test("GeneralDirectorService.updateBranchManager succeeds with normalized data - case 06", async () => {
  const service = new GeneralDirectorService(mockRepo({
    getBranchManagerById: async () => ({
      id: 5,
      fullName: 'Old Name'
    }),
    updateBranchManager: async (id, data) => ({
      id,
      ...data
    })
  }));
  const result = await service.updateBranchManager(5, {
    fullName: ' Nguyen Van B ',
    email: 'nguyenvanb@gmail.com',
    phone: '0909876543',
    branchId: '3',
    status: 'active'
  });
  assert.equal(result.status, 'active');
});
test("GeneralDirectorService.deactivateBranch and reactivateBranch validate branch existence - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.deactivateBranch(999), err => err.statusCode === 404 && /Chi nhánh/.test(err.message));
});
test("GeneralDirectorService.deactivateBranch and reactivateBranch validate branch existence - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  await assert.rejects(() => service.reactivateBranch(999), err => err.statusCode === 404 && /Chi nhánh/.test(err.message));
});
test("GeneralDirectorService.deactivateBranch and reactivateBranch update active status - case 01", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const deactivated = await service.deactivateBranch(2);
  const reactivated = await service.reactivateBranch(2);
  assert.deepEqual(deactivated, {
    id: 2,
    isActive: false
  });
});
test("GeneralDirectorService.deactivateBranch and reactivateBranch update active status - case 02", async () => {
  const service = new GeneralDirectorService(mockRepo());
  const deactivated = await service.deactivateBranch(2);
  const reactivated = await service.reactivateBranch(2);
  assert.deepEqual(reactivated, {
    id: 2,
    isActive: true
  });
});

const managerForm = {
  fullName: 'Nguyễn Văn A',
  email: 'manager@autogara.com',
  phone: '0912345678',
  password: 'Password1',
  confirmPassword: 'Password1',
  branchId: 1
};

test('Lọc quyết toán theo chi nhánh, trạng thái và khoảng ngày', async () => {
  let received;
  const service = new GeneralDirectorService(mockRepo({
    listSettlementReports: async filters => {
      received = filters;
      return [{ id: 1, code: 'RO-2026-001', status: 'invoiced' }];
    }
  }));
  const filters = {
    branchId: 1,
    status: 'invoiced',
    fromDate: '2026-01-01',
    toDate: '2026-09-10'
  };
  assert.deepEqual(await service.listSettlementReports(filters), [
    { id: 1, code: 'RO-2026-001', status: 'invoiced' }
  ]);
  assert.deepEqual(received, filters);
});

test('Danh sách quyết toán rỗng khi từ khóa không có kết quả', async () => {
  const service = new GeneralDirectorService(mockRepo({ listSettlementReports: async () => [] }));
  assert.deepEqual(await service.listSettlementReports({ search: 'không tồn tại' }), []);
});

for (const [label, method, listMethod, result, filters] of [
  ['nhân viên', 'getEmployeeById', 'listEmployees', { id: 1, fullName: 'Nguyễn Văn A' }, { search: 'Nguyễn', branchId: 1, status: 'active', role: 'all' }],
  ['kỹ thuật viên', 'getTechnicianById', 'listTechnicians', { id: 1, fullName: 'Nguyễn Văn B' }, { search: 'Nguyễn', branchId: 1, status: 'active', skillGroup: 'all' }],
  ['giám đốc chi nhánh', 'getBranchManagerById', 'listBranchManagers', { id: 1, fullName: 'Nguyễn Văn A' }, { search: 'Nguyễn', branchId: 1, status: 'active' }]
]) {
  test(`Lọc danh sách ${label} theo từ khóa, chi nhánh và trạng thái`, async () => {
    let received;
    const service = new GeneralDirectorService(mockRepo({
      [listMethod]: async value => {
        received = value;
        return [result];
      }
    }));
    assert.deepEqual(await service[listMethod](filters), [result]);
    assert.deepEqual(received, filters);
  });
  test(`Danh sách ${label} rỗng khi không có kết quả`, async () => {
    const service = new GeneralDirectorService(mockRepo({ [listMethod]: async () => [] }));
    assert.deepEqual(await service[listMethod]({ search: 'không tồn tại' }), []);
  });
  test(`Hiển thị ${label} có mã tồn tại`, async () => {
    const service = new GeneralDirectorService(mockRepo({ [method]: async () => result }));
    assert.deepEqual(await service[method](1), result);
  });
  test(`Thông báo khi mã ${label} không tồn tại`, async () => {
    const service = new GeneralDirectorService(mockRepo({ [method]: async () => null }));
    await assert.rejects(() => service[method](99999), err => err.statusCode === 404);
  });
}

test('Hiển thị quyết toán có mã tồn tại', async () => {
  const service = new GeneralDirectorService(mockRepo({
    getSettlementReportById: async () => ({ id: 1, code: 'RO-2026-001', status: 'invoiced' })
  }));
  assert.deepEqual(await service.getSettlementReportById(1), {
    id: 1, code: 'RO-2026-001', status: 'invoiced'
  });
});

test('Thông báo khi mã quyết toán không tồn tại', async () => {
  const service = new GeneralDirectorService(mockRepo({ getSettlementReportById: async () => null }));
  await assert.rejects(() => service.getSettlementReportById(99999), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy phiếu quyết toán'
  ));
});

test('Tạo giám đốc chi nhánh với đầy đủ dữ liệu trên biểu mẫu', async () => {
  const service = new GeneralDirectorService(mockRepo());
  const manager = await service.createBranchManager(managerForm);
  assert.equal(manager.id, 99);
  assert.equal(manager.fullName, 'Nguyễn Văn A');
  assert.equal(manager.email, 'manager@autogara.com');
  assert.equal(manager.phone, '0912345678');
  assert.equal(manager.branchId, 1);
  assert.equal(manager.status, 'active');
  assert.ok(manager.passwordHash);
});

for (const [field, label] of [
  ['fullName', 'họ và tên'],
  ['email', 'email'],
  ['branchId', 'chi nhánh']
]) {
  test(`Thông báo bắt buộc khi không nhập ${label} của giám đốc chi nhánh`, async () => {
    const service = new GeneralDirectorService(mockRepo());
    await assert.rejects(() => service.createBranchManager({ ...managerForm, [field]: null }), err => (
      err.statusCode === 400
      && err.message === 'Họ tên, email, số điện thoại, mật khẩu và chi nhánh là bắt buộc'
    ));
  });
}

test('Cập nhật giám đốc chi nhánh với đầy đủ dữ liệu trên biểu mẫu', async () => {
  const service = new GeneralDirectorService(mockRepo());
  const manager = await service.updateBranchManager(1, {
    fullName: 'Nguyễn Văn A',
    email: 'manager@autogara.com',
    phone: '0912345678',
    branchId: 1,
    status: 'active'
  });
  assert.deepEqual(manager, {
    id: 1,
    fullName: 'Nguyễn Văn A',
    email: 'manager@autogara.com',
    phone: '0912345678',
    branchId: 1,
    status: 'active'
  });
});

test('Thông báo khi cập nhật giám đốc chi nhánh không tồn tại', async () => {
  const service = new GeneralDirectorService(mockRepo({ getBranchManagerById: async () => null }));
  await assert.rejects(() => service.updateBranchManager(99999, {
    fullName: 'Nguyễn Văn A', email: 'manager@autogara.com', phone: '0912345678', branchId: 1
  }), err => err.statusCode === 404 && err.message === 'Không tìm thấy giám đốc chi nhánh');
});

for (const [overrides, message] of [
  [{ fullName: '' }, 'Họ tên, email, số điện thoại và chi nhánh là bắt buộc'],
  [{ email: 'abc' }, 'Email không đúng định dạng'],
  [{ phone: '123' }, 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số'],
  [{ status: 'invalid' }, 'Trạng thái không hợp lệ']
]) {
  test(`Thông báo khi dữ liệu cập nhật giám đốc chi nhánh không hợp lệ: ${message}`, async () => {
    const service = new GeneralDirectorService(mockRepo());
    await assert.rejects(() => service.updateBranchManager(1, {
      fullName: 'Nguyễn Văn A',
      email: 'manager@autogara.com',
      phone: '0912345678',
      branchId: 1,
      ...overrides
    }), err => err.statusCode === 400 && err.message === message);
  });
}

test('Ngừng hoạt động chi nhánh ID 1', async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.deepEqual(await service.deactivateBranch(1), { id: 1, isActive: false });
});

test('Kích hoạt lại chi nhánh ID 1', async () => {
  const service = new GeneralDirectorService(mockRepo());
  assert.deepEqual(await service.reactivateBranch(1), { id: 1, isActive: true });
});
