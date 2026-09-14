const {
  test
} = require('@jest/globals');
const assert = require('node:assert/strict');
const ManagerService = require('../../src/application/services/ManagerService');
const ROLES = [{
  id: 10,
  roleName: 'service_advisor'
}, {
  id: 11,
  roleName: 'team_leader'
}, {
  id: 12,
  roleName: 'warehouse_staff'
}];
function mockRepo(overrides = {}) {
  return {
    // Employees / team leader
    getEmployeeById: async () => ({
      id: 1,
      email: 'old@x.com',
      status: 'active'
    }),
    setTeamMembers: async (branchId, id, memberIds) => ({
      id,
      memberIds
    }),
    getBranchById: async () => ({
      id: 1,
      branchName: 'CN1'
    }),
    listAssignableRoles: async () => ROLES,
    listEmployees: async () => [],
    findByEmail: async () => null,
    nextPseudoId: async () => 'NV-001',
    createEmployee: async data => ({
      id: 100,
      ...data
    }),
    updateEmployee: async (branchId, id, data) => ({
      id,
      ...data
    }),
    // Services
    listServiceCategories: async () => [],
    listServices: async () => [{
      id: 700
    }, {
      id: 701
    }],
    getServiceById: async () => ({
      id: 1,
      isActive: true
    }),
    listProducts: async () => [{
      id: 500
    }, {
      id: 501
    }],
    nextServiceCode: async () => 'SV-001',
    createService: async data => ({
      id: 200,
      ...data
    }),
    updateService: async (branchId, id, data) => ({
      id,
      ...data
    }),
    listPackagesUsingService: async () => [],
    // Service packages
    listServicePackages: async () => [],
    getServicePackageById: async () => ({
      id: 1,
      isActive: true
    }),
    nextPackageCode: async () => 'PKG-001',
    createServicePackage: async data => ({
      id: 300,
      ...data
    }),
    updateServicePackage: async (branchId, id, data) => ({
      id,
      ...data
    }),
    isValidVehicleModel: async modelId => Number(modelId) === 1,
    // Settlement reports (read-only cho Manager)
    listSettlementReports: async () => [],
    getSettlementReportById: async () => ({
      id: 1,
      code: 'RO-2026-001'
    }),
    // Specialties / team leader options
    listSpecialties: async () => [{
      id: 1
    }, {
      id: 2
    }],
    listTeamLeaderOptions: async () => [{
      id: 900
    }],
    // Technicians
    listTechnicians: async () => [],
    getTechnicianById: async () => ({
      id: 1,
      email: 'tech@x.com',
      status: 'active'
    }),
    createTechnician: async data => ({
      id: 400,
      ...data
    }),
    updateTechnician: async (branchId, id, data) => ({
      id,
      ...data
    }),
    ...overrides
  };
}

// ─── Chi nhanh / Vai tro ───────────────────────────────────────────────
test('Lọc danh sách nhân viên theo từ khóa, vai trò và trạng thái', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listEmployees: async (branchId, filters) => {
      calls.push([branchId, filters]);
      return [{
        id: 1
      }];
    }
  }));
  assert.equal((await service.listEmployees(1, {
    search: 'Nguyễn',
    role: 'all',
    status: 'active'
  })).length, 1);
  assert.deepEqual(calls, [[1, { search: 'Nguyễn', role: 'all', status: 'active' }]]);
});
test('Không tìm thấy nhân viên theo bộ lọc trên giao diện', async () => {
  const service = new ManagerService(mockRepo({
    listEmployees: async () => []
  }));
  assert.deepEqual(await service.listEmployees(1, {
    search: 'không có',
    role: 'all',
    status: 'all'
  }), []);
});
test('Hiển thị nhân viên có mã tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  assert.deepEqual(await service.getEmployeeById(1, 1), {
    id: 1,
    email: 'old@x.com',
    status: 'active'
  });
});
test('Thông báo khi mã nhân viên không tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getEmployeeById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getEmployeeById(1, 99999), err => err.statusCode === 404);
});
function baseEmployeePayload(overrides = {}) {
  return {
    fullName: 'Nguyễn Văn A',
    email: 'nguyenvana@autogara.com',
    phone: '0912345678',
    roleId: 10,
    password: 'Password1',
    confirmPassword: 'Password1',
    ...overrides
  };
}
test('createEmployee rejects a blank full name from the employee form', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    fullName: ''
})), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
for (const [field, label] of [
  ['email', 'email'],
  ['phone', 'số điện thoại'],
  ['roleId', 'vai trò'],
  ['password', 'mật khẩu']
]) {
  test(`Thông báo bắt buộc khi không nhập ${label} nhân viên`, async () => {
    const service = new ManagerService(mockRepo());
    await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
      [field]: null
    })), err => (
      err.statusCode === 400
      && err.message === 'Họ tên, email, số điện thoại, vai trò và mật khẩu là bắt buộc'
    ));
  });
}
test('Thông báo khi email nhân viên sai định dạng', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    email: 'abc'
  })), err => err.statusCode === 400 && /Email/i.test(err.message));
});
test('Thông báo khi số điện thoại nhân viên sai định dạng', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    phone: '123'
  })), err => err.statusCode === 400 && /điện thoại/i.test(err.message));
});
test('Thông báo khi mật khẩu tạm thời của nhân viên ngắn hơn 8 ký tự', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    password: '1234567'
  })), err => err.statusCode === 400 && /ít nhất 8/i.test(err.message));
});
test('Thông báo khi xác nhận mật khẩu nhân viên không khớp', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    confirmPassword: 'Different1'
  })), err => err.statusCode === 400 && /Xác nhận mật khẩu/i.test(err.message));
});
test('Thông báo khi email nhân viên đã tồn tại', async () => {
  const serviceDup = new ManagerService(mockRepo({
    findByEmail: async () => ({
      id: 5
    })
  }));
  await assert.rejects(() => serviceDup.createEmployee(1, baseEmployeePayload({
    email: 'existing@autogara.com'
  })), err => (
    err.statusCode === 409 && err.message === 'Email đã tồn tại'
  ));
});
test('Thông báo khi vai trò nhân viên không hợp lệ', async () => {
  const serviceBadRole = new ManagerService(mockRepo());
  await assert.rejects(() => serviceBadRole.createEmployee(1, baseEmployeePayload({
    roleId: 9999
  })), err => err.statusCode === 400 && /Vai trò/i.test(err.message));
});
test('Không kiểm tra chuyên môn khi tạo cố vấn dịch vụ', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listSpecialties: async () => {
      calls.push('listSpecialties');
      return [{
        id: 1
      }];
    }
  }));
  await service.createEmployee(1, baseEmployeePayload({
    roleId: 10,
    specialtyIds: [999]
  }));
  assert.equal(calls.length, 0);
});
test('Thông báo khi chuyên môn của tổ trưởng không hợp lệ', async () => {
  const service = new ManagerService(mockRepo({
    listSpecialties: async () => [{ id: 1 }]
  }));
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    roleId: 11,
    specialtyIds: [999]
  })), err => err.statusCode === 400 && /chuyên môn/i.test(err.message));
});
test('Tạo nhân viên và sinh mã nhân viên', async () => {
  const service = new ManagerService(mockRepo());
  const employee = await service.createEmployee(1, baseEmployeePayload());
  assert.equal(employee.pseudoId, 'NV-001');
});
test('Tạo nhân viên với đầy đủ thông tin đã nhập', async () => {
  const service = new ManagerService(mockRepo());
  const employee = await service.createEmployee(1, baseEmployeePayload());
  assert.equal(employee.fullName, 'Nguyễn Văn A');
  assert.equal(employee.email, 'nguyenvana@autogara.com');
  assert.equal(employee.phone, '0912345678');
  assert.equal(employee.roleId, 10);
  assert.equal(employee.status, 'active');
  assert.ok(employee.passwordHash);
});
test('Cập nhật nhân viên với đầy đủ thông tin đã nhập', async () => {
  const service = new ManagerService(mockRepo());
  const updated = await service.updateEmployee(1, 1, baseEmployeePayload({ status: 'active' }));
  assert.equal(updated.id, 1);
  assert.equal(updated.fullName, 'Nguyễn Văn A');
  assert.equal(updated.email, 'nguyenvana@autogara.com');
  assert.equal(updated.phone, '0912345678');
  assert.equal(updated.roleId, 10);
  assert.equal(updated.status, 'active');
  assert.ok(updated.passwordHash);
});
test('Thông báo khi cập nhật nhân viên không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getEmployeeById: async () => null
  }));
  await assert.rejects(() => serviceMissing.updateEmployee(1, 99999, baseEmployeePayload()), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy nhân viên'
  ));
});
test('Thông báo khi bỏ trống họ tên lúc cập nhật nhân viên', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateEmployee(1, 1, baseEmployeePayload({
    fullName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test('Cập nhật nhân viên mà không đổi mật khẩu', async () => {
  const service = new ManagerService(mockRepo());
  const noPwd = {
    ...baseEmployeePayload(),
    password: undefined,
    confirmPassword: undefined
  };
  const updated = await service.updateEmployee(1, 1, noPwd);
  assert.equal(updated.passwordHash, undefined);
});
test('Thông báo khi mật khẩu mới của nhân viên ngắn hơn 8 ký tự', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateEmployee(1, 1, {
    ...baseEmployeePayload(),
    password: '1234567',
    confirmPassword: '1234567'
  }), err => err.statusCode === 400 && /ít nhất 8/i.test(err.message));
});
test('Thông báo khi xác nhận mật khẩu mới của nhân viên không khớp', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateEmployee(1, 1, {
    ...baseEmployeePayload(),
    password: 'Password1',
    confirmPassword: 'Different1'
  }), err => err.statusCode === 400 && /Xác nhận mật khẩu/i.test(err.message));
});
test('Thông báo khi đổi sang email của nhân viên khác', async () => {
  const service = new ManagerService(mockRepo({
    getEmployeeById: async () => ({
      id: 1,
      email: 'old@x.com',
      status: 'active'
    }),
    findByEmail: async () => ({
      id: 2
    })
  }));
  // Email khong doi (van la old@x.com) -> khong can check trung
  await assert.rejects(() => service.updateEmployee(1, 1, baseEmployeePayload({
    email: 'new@x.com'
  })), err => err.statusCode === 409);
});
test('Cập nhật nhân viên và giữ nguyên email hiện tại', async () => {
  const service = new ManagerService(mockRepo({
    getEmployeeById: async () => ({
      id: 1,
      email: 'old@x.com',
      status: 'active'
    }),
    findByEmail: async () => ({
      id: 2
    })
  }));
  // Email khong doi (van la old@x.com) -> khong can check trung
  const same = await service.updateEmployee(1, 1, baseEmployeePayload({
    email: 'old@x.com'
  }));
  assert.equal(same.email, 'old@x.com');
});
test('Lọc danh sách dịch vụ theo từ khóa, trạng thái và loại hình sửa chữa', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listServices: async (branchId, filters) => {
      calls.push([branchId, filters]);
      return [{ id: 700, serviceName: 'Thay dầu máy' }];
    }
  }));
  assert.deepEqual(await service.listServices(1, {
    search: 'thay dầu', status: 'active', repairCategory: 'PM'
  }), [{ id: 700, serviceName: 'Thay dầu máy' }]);
  assert.deepEqual(calls, [[1, {
    search: 'thay dầu', status: 'active', repairCategory: 'PM'
  }]]);
});
test('Không tìm thấy dịch vụ theo bộ lọc trên giao diện', async () => {
  const service = new ManagerService(mockRepo({ listServices: async () => [] }));
  assert.deepEqual(await service.listServices(1, {
    search: 'không có', status: 'all', repairCategory: 'all'
  }), []);
});
test('Hiển thị dịch vụ có mã tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  assert.deepEqual(await service.getServiceById(1, 1), { id: 1, isActive: true });
});
test('Thông báo khi mã dịch vụ không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getServiceById(1, 99999), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy dịch vụ'
  ));
});
function baseServicePayload(overrides = {}) {
  return {
    serviceName: 'Thay dầu máy',
    unitPrice: 500000,
    durationMin: 30,
    repairCategory: 'PM',
    description: 'Thay dầu động cơ',
    parts: [{ productId: 500, quantity: 1 }],
    ...overrides
  };
}
test("createService validates required name/price, price, duration, repairCategory - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    serviceName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test("createService validates required name/price, price, duration, repairCategory - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    unitPrice: null
  })), err => err.statusCode === 400 && err.message === 'Tên dịch vụ và đơn giá là bắt buộc');
});
test("createService validates required name/price, price, duration, repairCategory - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    unitPrice: -1
  })), err => err.statusCode === 400 && /Đơn giá/i.test(err.message));
});
test("createService validates required name/price, price, duration, repairCategory - case 04", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    durationMin: -5
  })), err => err.statusCode === 400 && /Thời gian/i.test(err.message));
});
test("createService validates required name/price, price, duration, repairCategory - case 05", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    repairCategory: 'XX'
  })), err => err.statusCode === 400 && /Loại hình sửa chữa/i.test(err.message));
});
test("createService validates parts: shape, duplicates, and branch ownership - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    parts: 'not-array'
  })), err => err.statusCode === 400 && /phụ tùng không hợp lệ/i.test(err.message));
});
test("createService validates parts: shape, duplicates, and branch ownership - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    parts: [{
      productId: 500,
      quantity: 0
    }]
  })), err => err.statusCode === 400 && /Phụ tùng và số lượng/i.test(err.message));
});
test("createService validates parts: shape, duplicates, and branch ownership - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    parts: [{
      productId: 500,
      quantity: 1
    }, {
      productId: 500,
      quantity: 2
    }]
  })), err => err.statusCode === 400 && /trùng 1 phụ tùng/i.test(err.message));
});
test("createService validates parts: shape, duplicates, and branch ownership - case 04", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    parts: [{
      productId: 9999,
      quantity: 1
    }]
  })), err => err.statusCode === 400 && /không thuộc chi nhánh/i.test(err.message));
});
test("createService succeeds with generated service code - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createService(1, baseServicePayload());
  assert.equal(created.serviceCode, 'SV-001');
});
test("createService succeeds with generated service code - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createService(1, baseServicePayload());
  assert.equal(created.unitPrice, 500000);
  assert.equal(created.serviceName, 'Thay dầu máy');
  assert.equal(created.durationMin, 30);
  assert.equal(created.repairCategory, 'PM');
  assert.equal(created.description, 'Thay dầu động cơ');
  assert.deepEqual(created.parts, [{ productId: 500, quantity: 1 }]);
});
test('Thông báo khi cập nhật dịch vụ không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  await assert.rejects(() => serviceMissing.updateService(1, 99999, baseServicePayload()), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy dịch vụ'
  ));
});
test('Ngừng hoạt động dịch vụ và trả về gói bảo dưỡng đang sử dụng', async () => {
  const serviceDeactivate = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    }),
    listPackagesUsingService: async () => [{
      id: 300,
      packageName: 'Gói bảo dưỡng cơ bản'
    }]
  }));
  const result = await serviceDeactivate.updateService(1, 1, baseServicePayload({
    isActive: false
  }));
  assert.deepEqual(result.usedInPackages, [{ id: 300, packageName: 'Gói bảo dưỡng cơ bản' }]);
});
test('Cập nhật dịch vụ và giữ trạng thái hoạt động', async () => {
  const serviceNoChange = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    })
  }));
  const resultNoChange = await serviceNoChange.updateService(1, 1, baseServicePayload({
    isActive: true
  }));
  assert.equal(resultNoChange.serviceName, 'Thay dầu máy');
  assert.equal(resultNoChange.unitPrice, 500000);
  assert.equal(resultNoChange.durationMin, 30);
  assert.equal(resultNoChange.repairCategory, 'PM');
  assert.equal(resultNoChange.description, 'Thay dầu động cơ');
  assert.deepEqual(resultNoChange.parts, [{ productId: 500, quantity: 1 }]);
  assert.equal(resultNoChange.isActive, true);
  assert.equal(resultNoChange.usedInPackages, undefined);
});
for (const [overrides, message] of [
  [{ serviceName: '' }, 'Tên dịch vụ và đơn giá là bắt buộc'],
  [{ unitPrice: -1 }, 'Đơn giá không hợp lệ'],
  [{ durationMin: -1 }, 'Thời gian thực hiện không hợp lệ'],
  [{ parts: [{ productId: 500, quantity: 0 }] }, 'Phụ tùng và số lượng không hợp lệ'],
  [{ parts: [{ productId: 500, quantity: 1 }, { productId: 500, quantity: 1 }] }, 'Không được chọn trùng 1 phụ tùng nhiều lần']
]) {
  test(`Thông báo khi dữ liệu cập nhật dịch vụ không hợp lệ: ${message}`, async () => {
    const service = new ManagerService(mockRepo());
    await assert.rejects(() => service.updateService(1, 1, baseServicePayload(overrides)), err => (
      err.statusCode === 400 && err.message === message
    ));
  });
}
test('Lọc danh sách gói bảo dưỡng theo từ khóa, trạng thái và loại hình sửa chữa', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listServicePackages: async (branchId, filters) => {
      calls.push([branchId, filters]);
      return [{ id: 1, packageName: 'Gói bảo dưỡng cơ bản' }];
    }
  }));
  assert.deepEqual(await service.listServicePackages(1, {
    search: 'bảo dưỡng', status: 'active', repairCategory: 'PM'
  }), [{ id: 1, packageName: 'Gói bảo dưỡng cơ bản' }]);
  assert.deepEqual(calls, [[1, {
    search: 'bảo dưỡng', status: 'active', repairCategory: 'PM'
  }]]);
});
test('Không tìm thấy gói bảo dưỡng theo bộ lọc trên giao diện', async () => {
  const service = new ManagerService(mockRepo({
    listServicePackages: async () => []
  }));
  assert.deepEqual(await service.listServicePackages(1, {
    search: 'không có', status: 'all', repairCategory: 'all'
  }), []);
});
test('Thông báo khi loại hình sửa chữa của bộ lọc gói không hợp lệ', async () => {
  const service = new ManagerService(mockRepo({
    listServicePackages: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listServicePackages(1, {
    repairCategory: 'invalid'
  }), err => err.statusCode === 400);
});
test('Hiển thị gói bảo dưỡng có mã tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  assert.deepEqual(await service.getServicePackageById(1, 1), { id: 1, isActive: true });
});
test('Thông báo khi mã gói bảo dưỡng không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getServicePackageById(1, 99999), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy gói bảo dưỡng'
  ));
});
function basePackagePayload(overrides = {}) {
  return {
    packageName: 'Gói bảo dưỡng cơ bản',
    totalPrice: 1200000,
    repairCategory: 'PM',
    description: 'Bảo dưỡng định kỳ',
    purpose: 'Bảo dưỡng',
    modelId: 1,
    services: [{
      serviceId: 700,
      actionCode: 'I'
    }],
    ...overrides
  };
}
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    packageName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    totalPrice: null
  })), err => err.statusCode === 400 && err.message === 'Tên gói và giá gói là bắt buộc');
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    totalPrice: -1
  })), err => err.statusCode === 400 && /Giá gói/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 04", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    repairCategory: 'XX'
  })), err => err.statusCode === 400 && /Loại hình sửa chữa/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 05", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    services: []
  })), err => err.statusCode === 400 && /ít nhất 1 dịch vụ/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 06", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    services: [{
      serviceId: 999,
      actionCode: 'R'
    }]
  })), err => err.statusCode === 400 && /không thuộc chi nhánh/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 07", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    services: [{
      serviceId: 700,
      actionCode: 'X'
    }]
  })), err => err.statusCode === 400 && /hành động không hợp lệ/i.test(err.message));
});
test("createServicePackage succeeds with generated package code - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createServicePackage(1, basePackagePayload());
  assert.equal(created.packageCode, 'PKG-001');
});
test("createServicePackage succeeds with generated package code - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createServicePackage(1, basePackagePayload());
  assert.deepEqual(created.services, [{
    serviceId: 700,
    actionCode: 'I'
  }]);
  assert.equal(created.packageName, 'Gói bảo dưỡng cơ bản');
  assert.equal(created.totalPrice, 1200000);
  assert.equal(created.description, 'Bảo dưỡng định kỳ');
  assert.equal(created.purpose, 'Bảo dưỡng');
  assert.equal(created.repairCategory, 'PM');
  assert.equal(created.modelId, 1);
});
test('Thông báo khi dòng xe áp dụng không hợp lệ', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    modelId: 999
  })), err => err.statusCode === 400 && /Dòng xe/i.test(err.message));
});
test('Tạo gói bảo dưỡng cho dòng xe hợp lệ', async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createServicePackage(1, basePackagePayload({
    modelId: 1
  }));
  assert.equal(created.modelId, 1);
});
test('Thông báo khi cập nhật gói bảo dưỡng không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  await assert.rejects(() => serviceMissing.updateServicePackage(1, 99999, basePackagePayload()), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy gói bảo dưỡng'
  ));
});
test('Cập nhật gói bảo dưỡng mà không thay đổi danh sách dịch vụ', async () => {
  const service = new ManagerService(mockRepo());
  const payload = basePackagePayload();
  delete payload.services;
  const updated = await service.updateServicePackage(1, 1, payload);
  assert.equal(updated.packageName, 'Gói bảo dưỡng cơ bản');
  assert.equal(updated.totalPrice, 1200000);
  assert.equal(updated.description, 'Bảo dưỡng định kỳ');
  assert.equal(updated.purpose, 'Bảo dưỡng');
  assert.equal(updated.repairCategory, 'PM');
  assert.equal(updated.modelId, 1);
  assert.equal(updated.services, undefined);
});
test('Thông báo khi dịch vụ cập nhật trong gói không thuộc chi nhánh', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateServicePackage(1, 1, basePackagePayload({
    services: [{
      serviceId: 999,
      actionCode: 'R'
    }]
  })), err => err.statusCode === 400 && /không thuộc chi nhánh/i.test(err.message));
});
for (const [overrides, message] of [
  [{ packageName: '' }, 'Tên gói và giá gói là bắt buộc'],
  [{ totalPrice: -1 }, 'Giá gói không hợp lệ'],
  [{ services: null }, 'Vui lòng chọn ít nhất 1 dịch vụ cho gói'],
  [{ modelId: 999 }, 'Dòng xe áp dụng không hợp lệ'],
  [{ services: [{ serviceId: 700, actionCode: 'X' }] }, 'Có dịch vụ không thuộc chi nhánh này hoặc hành động không hợp lệ']
]) {
  test(`Thông báo khi dữ liệu cập nhật gói bảo dưỡng không hợp lệ: ${message}`, async () => {
    const service = new ManagerService(mockRepo());
    await assert.rejects(() => service.updateServicePackage(1, 1, basePackagePayload(overrides)), err => (
      err.statusCode === 400 && err.message === message
    ));
  });
}
test("getSettlementReportById requires id and 404s - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getSettlementReportById: async () => null
  }));
  const report = await service.getSettlementReportById(1, 1);
  await assert.rejects(() => service.getSettlementReportById(1, null), err => err.statusCode === 400);
});
test("getSettlementReportById requires id and 404s - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getSettlementReportById: async () => null
  }));
  const report = await service.getSettlementReportById(1, 1);
  await assert.rejects(() => serviceMissing.getSettlementReportById(1, 99), err => err.statusCode === 404);
});
test("getSettlementReportById requires id and 404s - case 03", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getSettlementReportById: async () => null
  }));
  const report = await service.getSettlementReportById(1, 1);
  assert.equal(report.code, 'RO-2026-001');
});
test('Lọc danh sách thợ theo từ khóa, trạng thái và tổ trưởng', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listTechnicians: async (branchId, filters) => {
      calls.push([branchId, filters]);
      return [{ id: 1, fullName: 'Trần Văn B' }];
    }
  }));
  assert.deepEqual(await service.listTechnicians(1, {
    search: 'Trần', status: 'active', teamLeaderId: 'all'
  }), [{ id: 1, fullName: 'Trần Văn B' }]);
  assert.deepEqual(calls, [[1, {
    search: 'Trần', status: 'active', teamLeaderId: 'all'
  }]]);
});
test('Không tìm thấy thợ theo bộ lọc trên giao diện', async () => {
  const service = new ManagerService(mockRepo({
    listTechnicians: async () => []
  }));
  assert.deepEqual(await service.listTechnicians(1, {
    search: 'không có', status: 'all', teamLeaderId: 'all'
  }), []);
});
test('Thông báo khi trạng thái bộ lọc thợ không hợp lệ', async () => {
  const service = new ManagerService(mockRepo({
    listTechnicians: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listTechnicians(1, {
    status: 'invalid'
  }), err => err.statusCode === 400);
});
test('Hiển thị thợ có mã tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  assert.deepEqual(await service.getTechnicianById(1, 1), {
    id: 1, email: 'tech@x.com', status: 'active'
  });
});
test('Thông báo khi mã thợ không tồn tại', async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getTechnicianById(1, 99999), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy thợ máy'
  ));
});
function baseTechnicianPayload(overrides = {}) {
  return {
    fullName: 'Trần Văn B',
    email: 'tranvanb@autogara.com',
    phone: '0987654321',
    teamLeaderId: 900,
    specialtyIds: [1],
    ...overrides
  };
}
test("createTechnician requires contact fields and validates format (no account/password needed) - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    fullName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test("createTechnician requires contact fields and validates format (no account/password needed) - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    email: 'bad'
  })), err => err.statusCode === 400 && /Email/i.test(err.message));
});
test("createTechnician requires contact fields and validates format (no account/password needed) - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    phone: '123'
  })), err => err.statusCode === 400 && /điện thoại/i.test(err.message));
  // Khong con bat buoc mat khau - manager khong nhap, BE tu sinh ngau nhien.
});
test("createTechnician requires contact fields and validates format (no account/password needed) - case 04", async () => {
  const service = new ManagerService(mockRepo());
  // Khong con bat buoc mat khau - manager khong nhap, BE tu sinh ngau nhien.
  await assert.doesNotReject(() => service.createTechnician(1, baseTechnicianPayload({
    password: undefined
  })));
});
test("createTechnician requires a valid team leader belonging to the branch - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    teamLeaderId: null
  })), err => err.statusCode === 400 && /tổ trưởng/i.test(err.message));
});
test("createTechnician requires a valid team leader belonging to the branch - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    teamLeaderId: 12345
  })), err => err.statusCode === 400 && /Tổ trưởng không hợp lệ/i.test(err.message));
});
test("createTechnician validates specialtyIds and duplicate email - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const serviceDup = new ManagerService(mockRepo({
    findByEmail: async () => ({
      id: 9
    })
  }));
  await assert.rejects(() => service.createTechnician(1, baseTechnicianPayload({
    specialtyIds: [999]
  })), err => err.statusCode === 400 && /chuyên môn/i.test(err.message));
});
test("createTechnician validates specialtyIds and duplicate email - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const serviceDup = new ManagerService(mockRepo({
    findByEmail: async () => ({
      id: 9
    })
  }));
  await assert.rejects(() => serviceDup.createTechnician(1, baseTechnicianPayload()), err => err.statusCode === 409);
});
test("createTechnician succeeds - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createTechnician(1, baseTechnicianPayload());
  assert.equal(created.pseudoId, 'NV-001');
});
test("createTechnician succeeds - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createTechnician(1, baseTechnicianPayload());
  assert.equal(created.teamLeaderId, 900);
});
test('Tạo thợ với đầy đủ thông tin đã nhập', async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createTechnician(1, baseTechnicianPayload());
  assert.equal(created.fullName, 'Trần Văn B');
  assert.equal(created.email, 'tranvanb@autogara.com');
  assert.equal(created.phone, '0987654321');
  assert.equal(created.teamLeaderId, 900);
  assert.deepEqual(created.specialtyIds, [1]);
});
test("createTechnician succeeds - case 03", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createTechnician(1, baseTechnicianPayload());
  assert.ok(created.passwordHash);
});
test("updateTechnician 404s when missing and reuses contact/team-leader validation - case 01", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => serviceMissing.updateTechnician(1, 99, baseTechnicianPayload()), err => err.statusCode === 404);
});
test("updateTechnician 404s when missing and reuses contact/team-leader validation - case 02", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateTechnician(1, 1, baseTechnicianPayload({
    teamLeaderId: 12345
  })), err => err.statusCode === 400 && /Tổ trưởng không hợp lệ/i.test(err.message));
});
test("updateTechnician 404s when missing and reuses contact/team-leader validation - case 03", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateTechnician(1, 1, baseTechnicianPayload({
    status: 'weird'
  })), err => err.statusCode === 400 && /Trạng thái/i.test(err.message));
});
for (const [overrides, message] of [
  [{ fullName: '' }, 'Họ tên, email, số điện thoại là bắt buộc'],
  [{ email: 'abc' }, 'Email không đúng định dạng'],
  [{ phone: '123' }, 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số'],
  [{ specialtyIds: [999] }, 'Có chuyên môn không hợp lệ']
]) {
  test(`Thông báo khi dữ liệu cập nhật thợ không hợp lệ: ${message}`, async () => {
    const service = new ManagerService(mockRepo());
    await assert.rejects(() => service.updateTechnician(1, 1, baseTechnicianPayload(overrides)), err => (
      err.statusCode === 400 && err.message === message
    ));
  });
}
test('updateTechnician does not require/change password even if payload has one (no password field sent to repo)', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    updateTechnician: async (branchId, id, data) => {
      calls.push(data);
      return {
        id,
        ...data
      };
    }
  }));
  // Khong gui password -> van thanh cong (requirePassword=false trong _validateStaffContact)
  const payload = baseTechnicianPayload();
  delete payload.password;
  await service.updateTechnician(1, 1, payload);
  assert.equal('passwordHash' in calls[0], false);
});
test('Cập nhật thợ với đầy đủ thông tin đã nhập', async () => {
  const service = new ManagerService(mockRepo());
  const updated = await service.updateTechnician(1, 1, baseTechnicianPayload({ status: 'active' }));
  assert.equal(updated.fullName, 'Trần Văn B');
  assert.equal(updated.email, 'tranvanb@autogara.com');
  assert.equal(updated.phone, '0987654321');
  assert.equal(updated.teamLeaderId, 900);
  assert.deepEqual(updated.specialtyIds, [1]);
  assert.equal(updated.status, 'active');
});
test("updateTechnician rejects duplicate email only when changed - case 01", async () => {
  const service = new ManagerService(mockRepo({
    getTechnicianById: async () => ({
      id: 1,
      email: 'tech@x.com',
      status: 'active'
    }),
    findByEmail: async () => ({
      id: 2
    })
  }));
  const same = await service.updateTechnician(1, 1, baseTechnicianPayload({
    email: 'tech@x.com'
  }));
  await assert.rejects(() => service.updateTechnician(1, 1, baseTechnicianPayload({
    email: 'new@x.com'
  })), err => err.statusCode === 409);
});
test("updateTechnician rejects duplicate email only when changed - case 02", async () => {
  const service = new ManagerService(mockRepo({
    getTechnicianById: async () => ({
      id: 1,
      email: 'tech@x.com',
      status: 'active'
    }),
    findByEmail: async () => ({
      id: 2
    })
  }));
  const same = await service.updateTechnician(1, 1, baseTechnicianPayload({
    email: 'tech@x.com'
  }));
  assert.equal(same.email, 'tech@x.com');
});
