const test = require('node:test');
const assert = require('node:assert/strict');

const sqlPath = require.resolve('../../src/infrastructure/database/sqlServer');
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
require.cache[sqlPath] = {
  id: sqlPath,
  filename: sqlPath,
  loaded: true,
  exports: mockSql,
};

const servicePath = require.resolve('../../src/application/services/ServiceRequestService');
delete require.cache[servicePath];
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

test('getPublicVehicleBrands returns brand list', async () => {
  const brandPath = require.resolve('../../src/infrastructure/repositories/VehicleBrandRepository');
  require.cache[brandPath] = {
    id: brandPath,
    filename: brandPath,
    loaded: true,
    exports: class {
      async list() {
        return [{ id: 1, brandName: 'Kia' }, { id: 2, brandName: 'Mazda' }];
      }
    },
  };
  const service = new ServiceRequestService({ serviceRequestRepository: mockRepo() });
  const brands = await service.getPublicVehicleBrands();
  assert.equal(brands.length, 2);
  assert.equal(brands[0].name, 'Kia');
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
