const test = require('node:test');
const assert = require('node:assert/strict');
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

test('createPublic requires fullName, phone, issue, nearestBranchId', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });

  await assert.rejects(
    () => service.createPublic({ phone: '0912345678', issue: 'x', nearestBranchId: 1 }),
    (err) => err.statusCode === 400 && /họ và tên/i.test(err.message),
  );
  await assert.rejects(
    () => service.createPublic({ fullName: 'A', phone: '123', issue: 'x', nearestBranchId: 1 }),
    (err) => err.statusCode === 400 && /điện thoại không hợp lệ/i.test(err.message),
  );
  await assert.rejects(
    () => service.createPublic({ fullName: 'A', phone: '0912345678', issue: '', nearestBranchId: 1 }),
    (err) => err.statusCode === 400 && /vấn đề/i.test(err.message),
  );
  await assert.rejects(
    () => service.createPublic({ fullName: 'A', phone: '0912345678', issue: 'x' }),
    (err) => err.statusCode === 400 && /chi nhánh/i.test(err.message),
  );
});

test('createPublic rejects invalid email TLD', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(
    () =>
      service.createPublic({
        fullName: 'A',
        phone: '0912345678',
        email: 'a@mail.v',
        issue: 'Xe hỏng',
        nearestBranchId: 1,
      }),
    (err) => err.statusCode === 400 && /\.com|\.vn|edu\.vn/.test(err.message),
  );
});

test('createPublic accepts 10 and 11 digit phones', async () => {
  const created = [];
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      create: async (data) => {
        created.push(data.phone);
        return { id: created.length, nearestBranchId: data.nearestBranchId, ...data };
      },
    }),
  });

  await service.createPublic({
    fullName: 'A',
    phone: '0912345678',
    issue: 'Xe hỏng',
    nearestBranchId: 1,
  });
  await service.createPublic({
    fullName: 'B',
    phone: '09123456789',
    issue: 'Đèn',
    nearestBranchId: 1,
  });
  assert.deepEqual(created, ['0912345678', '09123456789']);
});

test('accept 404 / 403 / 409 paths', async () => {
  const serviceMissing = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  await assert.rejects(
    () => serviceMissing.accept(10, { userId: 5, userName: 'A', branchId: 1 }),
    (err) => err.statusCode === 404,
  );

  const serviceWrongBranch = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({ id: 10, nearestBranchId: 2, status: 'pending' }),
    }),
  });
  await assert.rejects(
    () => serviceWrongBranch.accept(10, { userId: 5, userName: 'A', branchId: 1 }),
    (err) => err.statusCode === 403,
  );

  const serviceRace = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({ id: 10, nearestBranchId: 1, status: 'pending' }),
      acceptAtomic: async () => null,
    }),
  });
  await assert.rejects(
    () => serviceRace.accept(10, { userId: 5, userName: 'A', branchId: 1 }),
    (err) => err.statusCode === 409,
  );
});

test('accept succeeds', async () => {
  const service = new ServiceRequestService({
    serviceRequestRepository: mockRepo({
      findById: async () => ({ id: 10, nearestBranchId: 1, status: 'pending' }),
      acceptAtomic: async () => ({
        id: 10,
        nearestBranchId: 1,
        status: 'accepted',
        acceptedBy: 5,
        acceptedAt: new Date(),
        appointments: [],
      }),
    }),
  });
  const dto = await service.accept(10, { userId: 5, userName: 'CVDV', branchId: 1 });
  assert.equal(dto.status, 'accepted');
});

test('createAppointment rejects past and missing datetime', async () => {
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
    () => service.createAppointment(10, {}, { userId: 5, branchId: 1 }),
    (err) => err.statusCode === 400 && /ngày giờ hẹn/i.test(err.message),
  );
  await assert.rejects(
    () =>
      service.createAppointment(
        10,
        { appointmentAt: '2020-01-01T09:00:00+07:00' },
        { userId: 5, branchId: 1 },
      ),
    (err) => err.statusCode === 400 && /quá khứ/i.test(err.message),
  );
});

test('createAppointment only owner can create', async () => {
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
      service.createAppointment(
        10,
        { appointmentAt: '2099-12-20T09:00:00+07:00' },
        { userId: 99, branchId: 1 },
      ),
    (err) => err.statusCode === 403,
  );
});

test('cancelAppointment requires non-empty reason', async () => {
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
    () => service.cancelAppointment(10, 3, '   ', { userId: 5, branchId: 1 }),
    (err) => err.statusCode === 400 && /lý do hủy/i.test(err.message),
  );
});
