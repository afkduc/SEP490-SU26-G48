const { test } = require('@jest/globals');
const assert = require('node:assert/strict');

// Stable query() so ServiceRequestService's destructured `query` can be redirected.
const mockSql = {
  queryImpl: async () => ({ recordset: [] }),
  async query(...args) {
    return mockSql.queryImpl(...args);
  },
  getPool: async () => ({}),
  executeTransaction: async (cb) => cb(async () => ({ recordset: [] })),
  sql: {},
};
jest.mock('../../src/infrastructure/database/sqlServer', () => mockSql);
const ServiceRequestService = require('../../src/application/services/ServiceRequestService');

function mockRepo(overrides = {}) {
  return {
    create: async (data) => ({ id: 1, nearestBranchId: data.nearestBranchId, ...data }),
    findByBranch: async () => [],
    countPendingByBranch: async () => 0,
    findById: async () => null,
    acceptAtomic: async () => null,
    createAppointment: async () => {},
    updateAppointment: async () => {},
    cancelAppointment: async () => {},
    ...overrides,
  };
}

test('listByBranch returns DTO list', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findByBranch: async (branchId, { status } = {}) => {
        assert.equal(branchId, 1);
        assert.equal(status, 'pending');
        return [{
          id: 1,
          fullName: 'A',
          phone: '0912345678',
          nearestBranchId: 1,
          status: 'pending',
          appointments: [],
        }];
      },
    }),
  });
  const items = await service.listByBranch(1, { status: 'pending' });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'pending');
});

test('getUnreadCount returns pending count', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      countPendingByBranch: async (branchId) => {
        assert.equal(branchId, 1);
        return 3;
      },
    }),
  });
  assert.equal(await service.getUnreadCount(1), 3);
});

test('getById enforces branch scope', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({ id: 10, nearestBranchId: 2, status: 'pending', appointments: [] }),
    }),
  });
  await assert.rejects(
    () => service.getById(10, 1),
    (err) => err.statusCode === 403,
  );
});

test('getById 404 when missing', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(
    () => service.getById(999, 1),
    (err) => err.statusCode === 404,
  );
});

test('getById returns DTO for same branch', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({
        id: 10,
        fullName: 'A',
        phone: '0912345678',
        nearestBranchId: 1,
        status: 'accepted',
        acceptedBy: 5,
        appointments: [],
      }),
    }),
  });
  const dto = await service.getById(10, 1);
  assert.equal(dto.id, 10);
  assert.equal(dto.status, 'accepted');
});

test('updateAppointment updates when owner and future date', async () => {
  let updated = null;
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({
        id: 10,
        nearestBranchId: 1,
        status: 'accepted',
        acceptedBy: 5,
        appointments: [],
      }),
      updateAppointment: async (appointmentId, data) => {
        updated = { appointmentId, ...data };
      },
    }),
  });
  const dto = await service.updateAppointment(
    10,
    3,
    { appointmentAt: '2099-12-21T10:00:00+07:00', notes: 'doi gio' },
    { userId: 5, branchId: 1 },
  );
  assert.equal(dto.id, 10);
  assert.equal(updated.appointmentId, 3);
});

test('updateAppointment rejects past datetime', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({
        id: 10,
        nearestBranchId: 1,
        status: 'accepted',
        acceptedBy: 5,
        appointments: [],
      }),
    }),
  });
  await assert.rejects(
    () =>
      service.updateAppointment(
        10,
        3,
        { appointmentAt: '2020-01-01T09:00:00+07:00' },
        { userId: 5, branchId: 1 },
      ),
    (err) => err.statusCode === 400 && /quá khứ/i.test(err.message),
  );
});

test('getPublicBranches filters inactive', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  service.branchRepository = {
    findAll: async () => [
      { id: 1, isActive: true, branchCode: 'HN', branchName: 'Ha Noi', address: 'A', phone: '01' },
      { id: 2, isActive: false, branchCode: 'HCM', branchName: 'HCM', address: 'B', phone: '02' },
    ],
  };
  const branches = await service.getPublicBranches();
  assert.equal(branches.length, 1);
  assert.equal(branches[0].code, 'HN');
});

test('getPublicServicePackages maps active packages', async () => {
  mockSql.queryImpl = async () => ({
    recordset: [
      {
        package_code: 'G01',
        package_name: 'BD',
        total_price: 1000,
        description: 'x',
        category_name: 'PM',
      },
    ],
  });
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  const pkgs = await service.getPublicServicePackages();
  assert.equal(pkgs.length, 1);
  assert.equal(pkgs[0].code, 'G01');
  assert.equal(pkgs[0].totalPrice, 1000);
});

test('getPublicServicePackageByCode 404 when missing', async () => {
  mockSql.queryImpl = async () => ({ recordset: [] });
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(
    () => service.getPublicServicePackageByCode('NOPE'),
    (err) => err.statusCode === 404,
  );
});

test('getPublicServicePackageByCode returns detail with items', async () => {
  let calls = 0;
  mockSql.queryImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        recordset: [{
          id: 9,
          package_name: 'Goi A',
          total_price: 2000,
          description: 'd',
          purpose: 'p',
          category_name: 'PM',
        }],
      };
    }
    return {
      recordset: [{ service_name: 'Thay dau', unit_price: 500 }],
    };
  };
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  const detail = await service.getPublicServicePackageByCode('G01');
  assert.equal(detail.name, 'Goi A');
  assert.equal(detail.items.length, 1);
  assert.equal(detail.items[0].unitPrice, 500);
});

function acceptedRequest(overrides = {}) {
  return {
    id: 1,
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    nearestBranchId: 1,
    status: 'accepted',
    acceptedBy: 5,
    appointments: [],
    ...overrides,
  };
}

test('Lọc yêu cầu của chi nhánh theo trạng thái chưa tiếp nhận', async () => {
  let received;
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findByBranch: async (branchId, filters) => {
        received = { branchId, ...filters };
        return [acceptedRequest({ status: 'pending', acceptedBy: null })];
      }
    })
  });
  const result = await service.listByBranch(1, { status: 'pending' });
  assert.equal(result.length, 1);
  assert.equal(result[0].fullName, 'Nguyễn Văn A');
  assert.deepEqual(received, { branchId: 1, status: 'pending' });
});

test('Danh sách yêu cầu của chi nhánh rỗng khi không có kết quả', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  assert.deepEqual(await service.listByBranch(1, { status: undefined }), []);
});

test('Hiển thị yêu cầu ID 1 thuộc đúng chi nhánh', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({ findById: async () => acceptedRequest() })
  });
  const result = await service.getById(1, 1);
  assert.equal(result.id, 1);
  assert.equal(result.fullName, 'Nguyễn Văn A');
  assert.equal(result.status, 'accepted');
});

test('Thông báo khi yêu cầu ID 99999 không tồn tại', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(() => service.getById(99999, 1), err => (
    err.statusCode === 404 && err.message === 'Không tìm thấy yêu cầu này'
  ));
});

test('Tiếp nhận yêu cầu ID 1 thành công', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => acceptedRequest({ status: 'pending', acceptedBy: null }),
      acceptAtomic: async () => acceptedRequest()
    })
  });
  const result = await service.accept(1, { userId: 5, userName: 'CVDV', branchId: 1 });
  assert.equal(result.id, 1);
  assert.equal(result.status, 'accepted');
  assert.equal(result.acceptedBy, 5);
});

for (const [id, entity, atomic, statusCode, message] of [
  [99999, null, null, 404, 'Không tìm thấy yêu cầu này'],
  [2, acceptedRequest({ id: 2, nearestBranchId: 2, status: 'pending' }), null, 403, 'Không có quyền thao tác trên yêu cầu của chi nhánh khác'],
  [3, acceptedRequest({ id: 3 }), null, 409, 'Yêu cầu này đã được CVDV khác tiếp nhận']
]) {
  test(`Thông báo khi không thể tiếp nhận yêu cầu ID ${id}`, async () => {
    const service = new ServiceRequestService({
      serviceRequestRepository: mockRepo({
        findById: async () => entity,
        acceptAtomic: async () => atomic
      })
    });
    await assert.rejects(() => service.accept(id, { userId: 5, userName: 'CVDV', branchId: 1 }), err => (
      err.statusCode === statusCode && err.message === message
    ));
  });
}

test('Tạo lịch hẹn ngày 2026-09-20 lúc 09:30', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-11T00:00:00Z') });
  try {
    let created;
    const service = new ServiceRequestService({
      serviceRequestRepository: mockRepo({
        findById: async () => acceptedRequest(),
        createAppointment: async (id, payload, userId) => { created = { id, payload, userId }; }
      })
    });
    const result = await service.createAppointment(1, {
      appointmentAt: '2026-09-20T09:30:00+07:00',
      notes: 'Khách đến kiểm tra xe'
    }, { userId: 5, branchId: 1 });
    assert.equal(result.id, 1);
    assert.deepEqual(created, {
      id: 1,
      payload: { appointmentAt: '2026-09-20T09:30:00+07:00', notes: 'Khách đến kiểm tra xe' },
      userId: 5
    });
  } finally {
    jest.useRealTimers();
  }
});

for (const [payload, userId, message] of [
  [{ appointmentAt: null }, 5, 'Vui lòng chọn ngày giờ hẹn'],
  [{ appointmentAt: '2026-01-01T09:30:00+07:00' }, 5, 'Không thể chọn ngày giờ hẹn trong quá khứ'],
  [{ appointmentAt: '2026-09-20T09:30:00+07:00' }, 99, 'Chỉ CVDV đã tiếp nhận yêu cầu này mới được thao tác']
]) {
  test(`Thông báo khi không thể tạo lịch hẹn: ${message}`, async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T00:00:00Z') });
    try {
      const service = new ServiceRequestService({
        serviceRequestRepository: mockRepo({ findById: async () => acceptedRequest() })
      });
      await assert.rejects(() => service.createAppointment(1, payload, { userId, branchId: 1 }), err => (
        err.message === message
      ));
    } finally {
      jest.useRealTimers();
    }
  });
}

test('Cập nhật lịch hẹn ID 10 sang ngày 2026-09-21 lúc 14:00', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-11T00:00:00Z') });
  try {
    let updated;
    const service = new ServiceRequestService({
      serviceRequestRepository: mockRepo({
        findById: async () => acceptedRequest(),
        updateAppointment: async (id, payload) => { updated = { id, ...payload }; }
      })
    });
    const result = await service.updateAppointment(1, 10, {
      appointmentAt: '2026-09-21T14:00:00+07:00',
      notes: 'Đổi giờ theo yêu cầu khách'
    }, { userId: 5, branchId: 1 });
    assert.equal(result.id, 1);
    assert.deepEqual(updated, {
      id: 10,
      appointmentAt: '2026-09-21T14:00:00+07:00',
      notes: 'Đổi giờ theo yêu cầu khách'
    });
  } finally {
    jest.useRealTimers();
  }
});

for (const [payload, userId, message] of [
  [{ appointmentAt: null }, 5, 'Vui lòng chọn ngày giờ hẹn'],
  [{ appointmentAt: '2026-01-01T14:00:00+07:00' }, 5, 'Không thể chọn ngày giờ hẹn trong quá khứ'],
  [{ appointmentAt: '2026-09-21T14:00:00+07:00' }, 99, 'Chỉ CVDV đã tiếp nhận yêu cầu này mới được thao tác']
]) {
  test(`Thông báo khi không thể cập nhật lịch hẹn: ${message}`, async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T00:00:00Z') });
    try {
      const service = new ServiceRequestService({
        serviceRequestRepository: mockRepo({ findById: async () => acceptedRequest() })
      });
      await assert.rejects(() => service.updateAppointment(1, 10, payload, { userId, branchId: 1 }), err => (
        err.message === message
      ));
    } finally {
      jest.useRealTimers();
    }
  });
}

test('Hủy lịch hẹn ID 10 với lý do đã nhập', async () => {
  let cancelled;
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => acceptedRequest(),
      cancelAppointment: async (id, reason, userId) => { cancelled = { id, reason, userId }; }
    })
  });
  const result = await service.cancelAppointment(1, 10, 'Khách đổi kế hoạch', { userId: 5, branchId: 1 });
  assert.equal(result.id, 1);
  assert.deepEqual(cancelled, { id: 10, reason: 'Khách đổi kế hoạch', userId: 5 });
});

test('Thông báo khi không nhập lý do hủy lịch hẹn', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({ findById: async () => acceptedRequest() })
  });
  await assert.rejects(() => service.cancelAppointment(1, 10, '', { userId: 5, branchId: 1 }), err => (
    err.statusCode === 400 && err.message === 'Phải nhập lý do hủy'
  ));
});

test('Thông báo khi hủy lịch hẹn của yêu cầu không tồn tại', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(() => service.cancelAppointment(99999, 10, 'Khách đổi kế hoạch', {
    userId: 5, branchId: 1
  }), err => err.statusCode === 404 && err.message === 'Không tìm thấy yêu cầu này');
});
