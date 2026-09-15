const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
jest.mock('../../src/application/services/NotificationService', () => class MockNotificationService {
  notify() {
    return Promise.resolve();
  }
});
const AdminUserService = require('../../src/application/services/AdminUserService');
function mockRepo(overrides = {}) {
  return {
    findRoleById: async () => ({
      id: 1,
      roleName: 'Admin',
      isActive: true
    }),
    findBranchById: async () => ({
      id: 1,
      branchCode: 'HN',
      isActive: true
    }),
    findByEmail: async () => null,
    findByPhone: async () => null,
    findById: async id => ({
      id,
      email: 'existing@mail.com',
      phone: '0901111111',
      status: 'active'
    }),
    create: async data => ({
      id: 99,
      ...data
    }),
    findAll: async () => ({
      items: [],
      total: 0
    }),
    findAllForExport: async () => ({
      items: [],
      total: 0
    }),
    updateUser: async data => ({
      id: data.userId,
      ...data
    }),
    updatePassword: async () => true,
    getDashboardStats: async () => ({}),
    findAllBranches: async () => [],
    findAllRoles: async () => [],
    ...overrides
  };
}
const validCreate = {
  name: 'admin01',
  email: 'admin01@autogara.com',
  password: 'Password1',
  lastName: 'An',
  firstName: 'Nguyễn Văn',
  phone: '0912345678',
  branchId: 1,
  roleId: 1
};
// Report 5.2 — Create User (Integration Test → AdminUserService)

test('Create User - 1: blank username rejected', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    name: ''
  }), err => err.statusCode === 400 && /Tên đăng nhập|bắt buộc/.test(err.message));
});
test('Create User - 2: invalid username rejected', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    name: '12'
  }), err => err.statusCode === 400 && /Tên đăng nhập/.test(err.message));
});
test("Create User - 3\u20134: blank and invalid email rejected - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    email: ''
  }), err => err.statusCode === 400);
});
test("Create User - 3\u20134: blank and invalid email rejected - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    email: 'bad@mail.v'
  }), err => err.statusCode === 400 && /Email chỉ chấp nhận/.test(err.message));
});
test("Create User - 5\u20138: password validation - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    password: ''
  }), err => err.statusCode === 400 && /bắt buộc|Mật khẩu/.test(err.message));
});
test("Create User - 5\u20138: password validation - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  for (const password of ['12345', 'abcdef', '123456']) {
    await assert.rejects(() => service.createUser({
      ...validCreate,
      password
    }), err => err.statusCode === 400 && /Mật khẩu/.test(err.message));
  }
});
test("Create User - 9\u201311: last name and phone validation - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    lastName: ''
  }), err => err.statusCode === 400 && /Tên là bắt buộc/.test(err.message));
});
test("Create User - 9\u201311: last name and phone validation - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    phone: ''
  }), err => err.statusCode === 400 && /Số điện thoại là bắt buộc/.test(err.message));
});
test("Create User - 9\u201311: last name and phone validation - case 03", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    phone: '12345'
  }), err => err.statusCode === 400 && /Số điện thoại phải bắt đầu/.test(err.message));
});
test("Create User - 12\u201313: branch and role required - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    branchId: '',
    scopeAllBranches: false
  }), err => err.statusCode === 400 && /branchId/.test(err.message));
});
test("Create User - 12\u201313: branch and role required - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    roleId: ''
  }), err => err.statusCode === 400 && /bắt buộc/.test(err.message));
});
test("Create User - 14\u201316: success paths (all branches, optional first name, valid data) - case 01", async () => {
  const created = [];
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      create: async data => {
        created.push(data);
        return {
          id: 100,
          ...data
        };
      }
    })
  });
  const allBranches = await service.createUser({
    ...validCreate,
    name: 'adminall',
    email: 'all@mail.com',
    phone: '0902222222',
    scopeAllBranches: true,
    branchId: null
  });
  await service.createUser({
    ...validCreate,
    name: 'nohof',
    email: 'nohof@mail.com',
    phone: '0903333333',
    firstName: ''
  });
  const user = await service.createUser({
    ...validCreate,
    name: 'fullvalid',
    email: 'full@mail.com',
    phone: '0904444444'
  });
  assert.equal(allBranches.id, 100);
});
test("Create User - 14\u201316: success paths (all branches, optional first name, valid data) - case 02", async () => {
  const created = [];
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      create: async data => {
        created.push(data);
        return {
          id: 100,
          ...data
        };
      }
    })
  });
  const allBranches = await service.createUser({
    ...validCreate,
    name: 'adminall',
    email: 'all@mail.com',
    phone: '0902222222',
    scopeAllBranches: true,
    branchId: null
  });
  await service.createUser({
    ...validCreate,
    name: 'nohof',
    email: 'nohof@mail.com',
    phone: '0903333333',
    firstName: ''
  });
  const user = await service.createUser({
    ...validCreate,
    name: 'fullvalid',
    email: 'full@mail.com',
    phone: '0904444444'
  });
  assert.equal(created[0].scopeAllBranches, true);
});
test("Create User - 14\u201316: success paths (all branches, optional first name, valid data) - case 03", async () => {
  const created = [];
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      create: async data => {
        created.push(data);
        return {
          id: 100,
          ...data
        };
      }
    })
  });
  const allBranches = await service.createUser({
    ...validCreate,
    name: 'adminall',
    email: 'all@mail.com',
    phone: '0902222222',
    scopeAllBranches: true,
    branchId: null
  });
  await service.createUser({
    ...validCreate,
    name: 'nohof',
    email: 'nohof@mail.com',
    phone: '0903333333',
    firstName: ''
  });
  const user = await service.createUser({
    ...validCreate,
    name: 'fullvalid',
    email: 'full@mail.com',
    phone: '0904444444'
  });
  assert.equal(user.id, 100);
});
test('Create User - 17: duplicate email rejected', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      findByEmail: async () => ({
        id: 2
      })
    })
  });
  await assert.rejects(() => service.createUser({
    ...validCreate,
    email: 'existing@autogara.com'
  }), err => err.statusCode === 409 && err.message === 'Email đã tồn tại');
});

test('Tạo người dùng với đầy đủ dữ liệu trên biểu mẫu', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  const user = await service.createUser(validCreate);
  assert.equal(user.id, 99);
  assert.equal(user.name, 'admin01');
  assert.equal(user.email, 'admin01@autogara.com');
  assert.equal(user.firstName, 'Nguyễn Văn');
  assert.equal(user.lastName, 'An');
  assert.equal(user.phone, '0912345678');
  assert.equal(user.branchId, 1);
  assert.equal(user.roleId, 1);
  assert.ok(user.passwordHash);
});

// Report 5.2 — User List Management
test('Lọc danh sách người dùng theo từ khóa, chi nhánh, vai trò và trạng thái', async () => {
  let received;
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      findAll: async filters => {
        received = filters;
        return { items: [{ id: 1, name: 'admin01' }], total: 1 };
      }
    })
  });
  const result = await service.listUsers({
    search: 'Nguyễn', branchId: 1, roleId: '1', status: 'active', page: 1, pageSize: 10
  });
  assert.deepEqual(result, { items: [{ id: 1, name: 'admin01' }], total: 1 });
  assert.deepEqual(received, {
    search: 'Nguyễn', branchId: 1, roleId: '1', status: 'active', page: 1, pageSize: 10
  });
});
test('Danh sách người dùng rỗng khi không có kết quả phù hợp', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  assert.deepEqual(await service.listUsers({
    search: 'không tồn tại', page: 1, pageSize: 10
  }), { items: [], total: 0 });
});
test("listUsers validates pagination and status - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const result = await service.listUsers({
    page: 1,
    pageSize: 10,
    status: 'active'
  });
  await assert.rejects(() => service.listUsers({
    page: -1
  }), err => err.statusCode === 400 && /page/.test(err.message));
});
test("listUsers validates pagination and status - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const result = await service.listUsers({
    page: 1,
    pageSize: 10,
    status: 'active'
  });
  await assert.rejects(() => service.listUsers({
    pageSize: 200
  }), err => err.statusCode === 400 && /pageSize/.test(err.message));
});
test("listUsers validates pagination and status - case 03", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const result = await service.listUsers({
    page: 1,
    pageSize: 10,
    status: 'active'
  });
  await assert.rejects(() => service.listUsers({
    status: 'locked'
  }), err => err.statusCode === 400 && /status/.test(err.message));
});
test("listUsers validates pagination and status - case 04", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const result = await service.listUsers({
    page: 1,
    pageSize: 10,
    status: 'active'
  });
  assert.deepEqual(result, {
    items: [],
    total: 0
  });
});
test("updateUser - 4/5: lock and reactivate user - case 01", async () => {
  const updates = [];
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      updateUser: async data => {
        updates.push(data);
        return {
          id: data.userId,
          status: data.status
        };
      }
    })
  });
  await service.updateUser({
    userId: 5,
    status: 'inactive',
    actorUserId: 1
  });
  await service.updateUser({
    userId: 5,
    status: 'active',
    actorUserId: 1
  });
  assert.equal(updates[0].status, 'inactive');
});
test("updateUser - 4/5: lock and reactivate user - case 02", async () => {
  const updates = [];
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      updateUser: async data => {
        updates.push(data);
        return {
          id: data.userId,
          status: data.status
        };
      }
    })
  });
  await service.updateUser({
    userId: 5,
    status: 'inactive',
    actorUserId: 1
  });
  await service.updateUser({
    userId: 5,
    status: 'active',
    actorUserId: 1
  });
  assert.equal(updates[1].status, 'active');
});
test('updateUser - 8: invalid phone during edit', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.updateUser({
    userId: 5,
    phone: '999'
  }), err => err.statusCode === 400 && /Số điện thoại phải bắt đầu/.test(err.message));
});
test('updateUser: cannot self-deactivate', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  await assert.rejects(() => service.updateUser({
    userId: 5,
    status: 'inactive',
    actorUserId: 5
  }), err => err.statusCode === 400 && /Không thể tự khóa/.test(err.message));
});
test('updateUser rejects an invalid email from the edit form', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  await assert.rejects(() => service.updateUser({ userId: 1, email: 'abc' }), err => err.statusCode === 400);
});
test('updateUser rejects an invalid status from the edit form', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  await assert.rejects(() => service.updateUser({ userId: 1, status: 'invalid' }), err => err.statusCode === 400);
});
test('Hiển thị thông tin người dùng có mã tồn tại', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  assert.deepEqual(await service.getUserDetail(1), {
    id: 1,
    email: 'existing@mail.com',
    phone: '0901111111',
    status: 'active'
  });
});
test('Cập nhật đầy đủ thông tin người dùng', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  const updated = await service.updateUser({
    userId: 1,
    firstName: 'Nguyễn Văn',
    lastName: 'An',
    email: 'admin01@autogara.com',
    phone: '0912345678',
    branchId: 1,
    roleId: 1,
    status: 'active'
  });
  assert.equal(updated.userId, 1);
  assert.equal(updated.firstName, 'Nguyễn Văn');
  assert.equal(updated.lastName, 'An');
  assert.equal(updated.email, 'admin01@autogara.com');
  assert.equal(updated.phone, '0912345678');
  assert.equal(updated.branchId, 1);
  assert.equal(updated.roleId, 1);
  assert.equal(updated.status, 'active');
});
test('Thông báo khi cập nhật người dùng không tồn tại', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({ findById: async () => null })
  });
  await assert.rejects(() => service.updateUser({ userId: 99999 }), err => (
    err.statusCode === 404 && err.message === 'Người dùng không tồn tại'
  ));
});
test("resetPassword - 13/15\u201318: random and manual modes - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.equal(random.userId, 5);
});
test("resetPassword - 13/15\u201318: random and manual modes - case 02", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.match(random.newPassword, /[A-Za-z0-9!@#$%^&*]/);
});
test("resetPassword - 13/15\u201318: random and manual modes - case 03", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.equal(random.isManual, false);
});
test("resetPassword - 13/15\u201318: random and manual modes - case 04", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.throws(() => service.validateManualPassword(''), err => err.statusCode === 400 && /Mật khẩu mới là bắt buộc/.test(err.message));
});
test("resetPassword - 13/15\u201318: random and manual modes - case 05", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.throws(() => service.validateManualPassword('abc'), err => err.statusCode === 400 && /Mật khẩu tối thiểu/.test(err.message));
});
test("resetPassword - 13/15\u201318: random and manual modes - case 06", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.equal(manual.isManual, true);
});
test("resetPassword - 13/15\u201318: random and manual modes - case 07", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo()
  });
  const random = await service.resetPassword({
    userId: 5
  });
  const manual = await service.resetPassword({
    userId: 5,
    newPassword: 'NewPass1'
  });
  assert.equal(manual.newPassword, 'NewPass1');
});
test('resetPassword: user not found', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      findById: async () => null
    })
  });
  await assert.rejects(() => service.resetPassword({
    userId: 999
  }), err => err.statusCode === 404);
});
test('Tạo mật khẩu tự động cho người dùng ID 1', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  const result = await service.resetPassword({ userId: 1 });
  assert.equal(result.userId, 1);
  assert.equal(result.isManual, false);
  assert.equal(result.newPassword.length, 12);
  assert.match(result.newPassword, /[A-Z]/);
  assert.match(result.newPassword, /[a-z]/);
  assert.match(result.newPassword, /[0-9]/);
  assert.match(result.newPassword, /[!@#$%^&*]/);
});
test('Đặt mật khẩu Password2 cho người dùng ID 1', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  const result = await service.resetPassword({ userId: 1, newPassword: 'Password2' });
  assert.equal(result.userId, 1);
  assert.equal(result.newPassword, 'Password2');
  assert.equal(result.isManual, true);
});
test('Thông báo khi mật khẩu mới chỉ có 3 ký tự', async () => {
  const service = new AdminUserService({ adminUserRepository: mockRepo() });
  await assert.rejects(() => service.resetPassword({ userId: 1, newPassword: '123' }), err => (
    err.statusCode === 400 && err.message === 'Mật khẩu tối thiểu 6 ký tự, gồm chữ và số'
  ));
});
test('Thông báo khi đặt lại mật khẩu cho người dùng không tồn tại', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({ findById: async () => null })
  });
  await assert.rejects(() => service.resetPassword({ userId: 99999 }), err => (
    err.statusCode === 404 && err.message === 'Người dùng không tồn tại'
  ));
});
test("getUserDetail requires userId and returns 404 when missing - case 01", async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      findById: async id => id === 5 ? {
        id: 5
      } : null
    })
  });
  await assert.rejects(() => service.getUserDetail(null), err => err.statusCode === 400);
});
test('Thông báo khi mã người dùng không tồn tại', async () => {
  const service = new AdminUserService({
    adminUserRepository: mockRepo({
      findById: async id => id === 5 ? {
        id: 5
      } : null
    })
  });
  await assert.rejects(() => service.getUserDetail(99999), err => (
    err.statusCode === 404 && err.message === 'Người dùng không tồn tại'
  ));
});
