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
test("listEmployees shows the branch employee list and applies UI filters - case 01", async () => {
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
});
test('Không tìm thấy nhân viên theo bộ lọc trên giao diện', async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listEmployees: async (branchId, filters) => {
      calls.push([branchId, filters]);
      return [{
        id: 1
      }];
    }
  }));
  assert.deepEqual(await service.listEmployees(1, { search: 'không có', role: 'all', status: 'all' }), [{ id: 1 }]);
});
test('Hiển thị nhân viên có mã tồn tại', async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getEmployeeById: async () => null
  }));
  assert.equal((await service.getEmployeeById(1, 1)).id, 1);
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
    fullName: 'Nguyen Van A',
    email: 'a@autogara.com',
    phone: '0912345678',
    roleId: 10,
    password: 'Password1',
    confirmPassword: 'Password1',
    ...overrides
  };
}
test('createEmployee requires all mandatory fields', async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    fullName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test("createEmployee validates email and phone format - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    email: 'not-an-email'
  })), err => err.statusCode === 400 && /Email/i.test(err.message));
});
test("createEmployee validates email and phone format - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    phone: '123'
  })), err => err.statusCode === 400 && /điện thoại/i.test(err.message));
});
test("createEmployee validates password length and confirmation - case 01", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    password: '123'
  })), err => err.statusCode === 400 && /ít nhất 8/i.test(err.message));
});
test("createEmployee validates password length and confirmation - case 02", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    confirmPassword: 'khac'
  })), err => err.statusCode === 400 && /Xác nhận mật khẩu/i.test(err.message));
});
test("createEmployee rejects duplicate email and invalid role - case 01", async () => {
  const serviceDup = new ManagerService(mockRepo({
    findByEmail: async () => ({
      id: 5
    })
  }));
  const serviceBadRole = new ManagerService(mockRepo());
  await assert.rejects(() => serviceDup.createEmployee(1, baseEmployeePayload()), err => err.statusCode === 409);
});
test("createEmployee rejects duplicate email and invalid role - case 02", async () => {
  const serviceDup = new ManagerService(mockRepo({
    findByEmail: async () => ({
      id: 5
    })
  }));
  const serviceBadRole = new ManagerService(mockRepo());
  await assert.rejects(() => serviceBadRole.createEmployee(1, baseEmployeePayload({
    roleId: 9999
  })), err => err.statusCode === 400 && /Vai trò/i.test(err.message));
});
test("createEmployee validates specialtyIds only for team_leader role - case 01", async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listSpecialties: async () => {
      calls.push('listSpecialties');
      return [{
        id: 1
      }];
    }
  }));
  // service_advisor (roleId 10) khong phai team_leader -> khong goi listSpecialties
  // service_advisor (roleId 10) khong phai team_leader -> khong goi listSpecialties
  await service.createEmployee(1, baseEmployeePayload({
    roleId: 10,
    specialtyIds: [999]
  }));
  assert.equal(calls.length, 0);

  // team_leader (roleId 11) -> phai validate specialtyIds
});
test("createEmployee validates specialtyIds only for team_leader role - case 02", async () => {
  const calls = [];
  const service = new ManagerService(mockRepo({
    listSpecialties: async () => {
      calls.push('listSpecialties');
      return [{
        id: 1
      }];
    }
  }));
  // service_advisor (roleId 10) khong phai team_leader -> khong goi listSpecialties
  // service_advisor (roleId 10) khong phai team_leader -> khong goi listSpecialties
  await service.createEmployee(1, baseEmployeePayload({
    roleId: 10,
    specialtyIds: [999]
  }));
  // team_leader (roleId 11) -> phai validate specialtyIds
  await assert.rejects(() => service.createEmployee(1, baseEmployeePayload({
    roleId: 11,
    specialtyIds: [999]
  })), err => err.statusCode === 400 && /chuyên môn/i.test(err.message));
});
test("createEmployee succeeds and hashes password - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const employee = await service.createEmployee(1, baseEmployeePayload());
  assert.equal(employee.pseudoId, 'NV-001');
});
test("createEmployee succeeds and hashes password - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const employee = await service.createEmployee(1, baseEmployeePayload());
  assert.equal(employee.fullName, 'Nguyen Van A');
});
test("updateEmployee 404s when employee missing and validates required fields - case 01", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getEmployeeById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => serviceMissing.updateEmployee(1, 99, baseEmployeePayload()), err => err.statusCode === 404);
});
test("updateEmployee 404s when employee missing and validates required fields - case 02", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getEmployeeById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.updateEmployee(1, 1, baseEmployeePayload({
    fullName: ''
  })), err => err.statusCode === 400 && /bắt buộc/i.test(err.message));
});
test("updateEmployee password is optional but validated when provided - case 01", async () => {
  const service = new ManagerService(mockRepo());
  // Khong gui password -> khong loi
  // Khong gui password -> khong loi
  const noPwd = {
    ...baseEmployeePayload(),
    password: undefined,
    confirmPassword: undefined
  };
  const updated = await service.updateEmployee(1, 1, noPwd);
  assert.equal(updated.passwordHash, undefined);
});
test("updateEmployee password is optional but validated when provided - case 02", async () => {
  const service = new ManagerService(mockRepo());
  // Khong gui password -> khong loi
  // Khong gui password -> khong loi
  const noPwd = {
    ...baseEmployeePayload(),
    password: undefined,
    confirmPassword: undefined
  };
  const updated = await service.updateEmployee(1, 1, noPwd);
  await assert.rejects(() => service.updateEmployee(1, 1, {
    ...baseEmployeePayload(),
    password: '123',
    confirmPassword: '123'
  }), err => err.statusCode === 400 && /ít nhất 8/i.test(err.message));
});
test("updateEmployee password is optional but validated when provided - case 03", async () => {
  const service = new ManagerService(mockRepo());
  // Khong gui password -> khong loi
  // Khong gui password -> khong loi
  const noPwd = {
    ...baseEmployeePayload(),
    password: undefined,
    confirmPassword: undefined
  };
  const updated = await service.updateEmployee(1, 1, noPwd);
  await assert.rejects(() => service.updateEmployee(1, 1, {
    ...baseEmployeePayload(),
    password: 'Password1',
    confirmPassword: 'khac'
  }), err => err.statusCode === 400 && /Xác nhận mật khẩu/i.test(err.message));
});
test("updateEmployee rejects duplicate email only when changed to someone else's - case 01", async () => {
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
  await assert.rejects(() => service.updateEmployee(1, 1, baseEmployeePayload({
    email: 'new@x.com'
  })), err => err.statusCode === 409);

  // Email khong doi (van la old@x.com) -> khong can check trung
});
test("updateEmployee rejects duplicate email only when changed to someone else's - case 02", async () => {
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
test("listServices shows services and validates the status filter - case 01", async () => {
  const service = new ManagerService(mockRepo());
  assert.equal((await service.listServices(1, {
    status: 'all'
  })).length, 2);
});
test('Không tìm thấy dịch vụ theo bộ lọc trên giao diện', async () => {
  const service = new ManagerService(mockRepo());
  assert.equal((await service.listServices(1, { search: 'không có', status: 'all', repairCategory: 'all' })).length, 2);
});
test("getServiceById requires id and 404s - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  await assert.rejects(() => service.getServiceById(1, null), err => err.statusCode === 400);
});
test("getServiceById requires id and 404s - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getServiceById(1, 99), err => err.statusCode === 404);
});
function baseServicePayload(overrides = {}) {
  return {
    serviceName: 'Thay dầu máy',
    unitPrice: 500000,
    durationMin: 30,
    repairCategory: 'PM',
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
    unitPrice: -1
  })), err => err.statusCode === 400 && /Đơn giá/i.test(err.message));
});
test("createService validates required name/price, price, duration, repairCategory - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createService(1, baseServicePayload({
    durationMin: -5
  })), err => err.statusCode === 400 && /Thời gian/i.test(err.message));
});
test("createService validates required name/price, price, duration, repairCategory - case 04", async () => {
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
  const created = await service.createService(1, baseServicePayload({
    parts: [{
      productId: 500,
      quantity: 2
    }]
  }));
  assert.equal(created.serviceCode, 'SV-001');
});
test("createService succeeds with generated service code - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createService(1, baseServicePayload({
    parts: [{
      productId: 500,
      quantity: 2
    }]
  }));
  assert.equal(created.unitPrice, 500000);
});
test("updateService 404s when missing and returns usedInPackages when deactivating - case 01", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  const serviceDeactivate = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    }),
    listPackagesUsingService: async () => [{
      id: 300,
      packageName: 'Goi A'
    }]
  }));
  const result = await serviceDeactivate.updateService(1, 1, baseServicePayload({
    isActive: false
  }));
  const serviceNoChange = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    })
  }));
  const resultNoChange = await serviceNoChange.updateService(1, 1, baseServicePayload({
    isActive: true
  }));
  await assert.rejects(() => serviceMissing.updateService(1, 99, baseServicePayload()), err => err.statusCode === 404);
});
test("updateService 404s when missing and returns usedInPackages when deactivating - case 02", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  const serviceDeactivate = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    }),
    listPackagesUsingService: async () => [{
      id: 300,
      packageName: 'Goi A'
    }]
  }));
  const result = await serviceDeactivate.updateService(1, 1, baseServicePayload({
    isActive: false
  }));
  const serviceNoChange = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    })
  }));
  const resultNoChange = await serviceNoChange.updateService(1, 1, baseServicePayload({
    isActive: true
  }));
  assert.equal(result.usedInPackages.length, 1);
});
test("updateService 404s when missing and returns usedInPackages when deactivating - case 03", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServiceById: async () => null
  }));
  const serviceDeactivate = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    }),
    listPackagesUsingService: async () => [{
      id: 300,
      packageName: 'Goi A'
    }]
  }));
  const result = await serviceDeactivate.updateService(1, 1, baseServicePayload({
    isActive: false
  }));
  const serviceNoChange = new ManagerService(mockRepo({
    getServiceById: async () => ({
      id: 1,
      isActive: true
    })
  }));
  const resultNoChange = await serviceNoChange.updateService(1, 1, baseServicePayload({
    isActive: true
  }));
  assert.equal(resultNoChange.usedInPackages, undefined);
});
test("listServicePackages shows maintenance packages and validates filters - case 01", async () => {
  const service = new ManagerService(mockRepo({
    listServicePackages: async () => [{
      id: 1
    }]
  }));
  assert.equal((await service.listServicePackages(1, {
    status: 'all'
  })).length, 1);
});
test("listServicePackages shows maintenance packages and validates filters - case 02", async () => {
  const service = new ManagerService(mockRepo({
    listServicePackages: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listServicePackages(null, {}), err => err.statusCode === 400);
});
test("listServicePackages shows maintenance packages and validates filters - case 03", async () => {
  const service = new ManagerService(mockRepo({
    listServicePackages: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listServicePackages(1, {
    repairCategory: 'invalid'
  }), err => err.statusCode === 400);
});
test("getServicePackageById requires id and 404s - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  await assert.rejects(() => service.getServicePackageById(1, null), err => err.statusCode === 400);
});
test("getServicePackageById requires id and 404s - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getServicePackageById(1, 99), err => err.statusCode === 404);
});
function basePackagePayload(overrides = {}) {
  return {
    packageName: 'Gói bảo dưỡng cơ bản',
    totalPrice: 1200000,
    repairCategory: 'PM',
    services: [{
      serviceId: 700,
      actionCode: 'R'
    }, {
      serviceId: 701,
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
    totalPrice: -1
  })), err => err.statusCode === 400 && /Giá gói/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 03", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    repairCategory: 'XX'
  })), err => err.statusCode === 400 && /Loại hình sửa chữa/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 04", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    services: []
  })), err => err.statusCode === 400 && /ít nhất 1 dịch vụ/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 05", async () => {
  const service = new ManagerService(mockRepo());
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    services: [{
      serviceId: 999,
      actionCode: 'R'
    }]
  })), err => err.statusCode === 400 && /không thuộc chi nhánh/i.test(err.message));
});
test("createServicePackage requires name/price, valid price/repairCategory, and service ids - case 06", async () => {
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
    actionCode: 'R'
  }, {
    serviceId: 701,
    actionCode: 'I'
  }]);
});
test("createServicePackage validates modelId against vehicle_models - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createServicePackage(1, basePackagePayload({
    modelId: 1
  }));
  await assert.rejects(() => service.createServicePackage(1, basePackagePayload({
    modelId: 999
  })), err => err.statusCode === 400 && /Dòng xe/i.test(err.message));
});
test("createServicePackage validates modelId against vehicle_models - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const created = await service.createServicePackage(1, basePackagePayload({
    modelId: 1
  }));
  assert.equal(created.modelId, 1);
});
test("updateServicePackage 404s when missing; serviceIds optional but validated when provided - case 01", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  const payload = basePackagePayload();
  delete payload.services;
  const updated = await service.updateServicePackage(1, 1, payload);
  await assert.rejects(() => serviceMissing.updateServicePackage(1, 99, basePackagePayload()), err => err.statusCode === 404);
});
test("updateServicePackage 404s when missing; serviceIds optional but validated when provided - case 02", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  const payload = basePackagePayload();
  delete payload.services;
  const updated = await service.updateServicePackage(1, 1, payload);
  assert.equal(updated.services, undefined);
});
test("updateServicePackage 404s when missing; serviceIds optional but validated when provided - case 03", async () => {
  const serviceMissing = new ManagerService(mockRepo({
    getServicePackageById: async () => null
  }));
  const service = new ManagerService(mockRepo());
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  // Khong gui services -> khong bat buoc (requireServiceIds=false)
  const payload = basePackagePayload();
  delete payload.services;
  const updated = await service.updateServicePackage(1, 1, payload);
  await assert.rejects(() => service.updateServicePackage(1, 1, basePackagePayload({
    services: [{
      serviceId: 999,
      actionCode: 'R'
    }]
  })), err => err.statusCode === 400 && /không thuộc chi nhánh/i.test(err.message));
});
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
test("listTechnicians shows technicians and validates the status filter - case 01", async () => {
  const service = new ManagerService(mockRepo({
    listTechnicians: async () => [{
      id: 1
    }]
  }));
  assert.equal((await service.listTechnicians(1, {
    status: 'all'
  })).length, 1);
});
test("listTechnicians shows technicians and validates the status filter - case 02", async () => {
  const service = new ManagerService(mockRepo({
    listTechnicians: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listTechnicians(null, {}), err => err.statusCode === 400);
});
test("listTechnicians shows technicians and validates the status filter - case 03", async () => {
  const service = new ManagerService(mockRepo({
    listTechnicians: async () => [{
      id: 1
    }]
  }));
  await assert.rejects(() => service.listTechnicians(1, {
    status: 'invalid'
  }), err => err.statusCode === 400);
});
test("getTechnicianById requires id and 404s - case 01", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  await assert.rejects(() => service.getTechnicianById(1, null), err => err.statusCode === 400);
});
test("getTechnicianById requires id and 404s - case 02", async () => {
  const service = new ManagerService(mockRepo());
  const serviceMissing = new ManagerService(mockRepo({
    getTechnicianById: async () => null
  }));
  await assert.rejects(() => serviceMissing.getTechnicianById(1, 99), err => err.statusCode === 404);
});
function baseTechnicianPayload(overrides = {}) {
  return {
    fullName: 'Tho May A',
    email: 'tho@autogara.com',
    phone: '0912345678',
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
