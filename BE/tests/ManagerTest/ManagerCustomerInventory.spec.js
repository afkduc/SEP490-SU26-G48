const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const CustomerService = require('../../src/application/services/CustomerService');
const InventoryService = require('../../src/application/services/InventoryService');
const RepairSettlementService = require('../../src/application/services/RepairSettlementService');

function inventoryService(items = []) {
  let received;
  const service = new InventoryService({ inventoryRepository: {
    getStockByBranch: async (branchId, filters) => { received = { branchId, ...filters }; return items; },
    countStockByBranch: async () => items.length,
  } });
  return { service, received: () => received };
}

test('Lọc phụ tùng theo từ khóa, danh mục và trang', async () => {
  const context = inventoryService([{ id: 1 }]);
  const result = await context.service.getStockList({ branchId: 1, search: 'lọc dầu', category: 'Động cơ', page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(context.received().search, 'lọc dầu');
  assert.equal(context.received().category, 'Động cơ');
});

test('Không tìm thấy phụ tùng theo từ khóa', async () => {
  const { service } = inventoryService();
  assert.equal((await service.getStockList({ branchId: 1, search: 'không có', page: 1, limit: 20 })).total, 0);
});

test('Tài khoản chưa được gán chi nhánh', async () => {
  const { service } = inventoryService();
  await assert.rejects(() => service.getStockList({ branchId: null }), error => error.statusCode === 400);
});

function customerRepo(overrides = {}) {
  return {
    findAllWithDetails: async () => [],
    findByIdWithDetails: async id => ({ id, fullName: 'Nguyễn Văn A', phone: '0912345678', vehicles: [] }),
    // update() kiem tra SDT moi chua thuoc khach khac (findByPhone) - mac dinh chua ai dung.
    findByPhone: async () => null,
    update: async (id, data) => ({ id, ...data }),
    ...overrides,
  };
}

for (const [label, search] of [['Tìm khách hàng theo họ tên', 'Nguyễn Văn A'], ['Tìm khách hàng theo số điện thoại', '0912345678'], ['Tìm khách hàng theo biển số xe', '30A12345']]) {
  test(label, async () => {
    let filters;
    const service = new CustomerService({ customerRepository: customerRepo({ findAllWithDetails: async value => {
      filters = value;
      return [{ id: 1, fullName: 'Nguyễn Văn A', phone: '0912345678', vehicles: [{ licensePlate: '30A12345' }], historyCount: 0 }];
    } }) });
    assert.equal((await service.getAll({ search, page: 1, limit: 20 })).total, 1);
    assert.equal(filters, undefined);
  });
}

test('Không tìm thấy khách hàng theo từ khóa', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  assert.equal((await service.getAll({ search: 'không có', page: 1, limit: 20 })).total, 0);
});

test('Hiển thị khách hàng có mã tồn tại', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  assert.deepEqual(await service.getById(1), {
    id: 1,
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    vehicles: []
  });
});

test('Không trả khách hàng ngoài phạm vi chi nhánh đăng nhập', async () => {
  let receivedBranchId;
  const service = new CustomerService({ customerRepository: customerRepo({
    findByIdWithDetails: async (id, branchId) => {
      receivedBranchId = branchId;
      return null;
    }
  }) });

  await assert.rejects(() => service.getById(8, 2), error => error.statusCode === 404);
  assert.equal(receivedBranchId, 2);
});

test('Thông báo khi mã khách hàng không tồn tại', async () => {
  const service = new CustomerService({ customerRepository: customerRepo({ findByIdWithDetails: async () => null }) });
  await assert.rejects(() => service.getById(99999), error => (
    error.statusCode === 404 && error.message === 'Không tìm thấy khách hàng'
  ));
});

const customerUpdate = { fullName: 'Nguyễn Văn B', phone: '0987654321', email: 'b@example.com', address: 'Hà Nội' };

test('Cập nhật đầy đủ thông tin khách hàng', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  assert.deepEqual(await service.update(1, customerUpdate), { id: 1, ...customerUpdate });
});

test('Không nhập họ và tên khi cập nhật khách hàng', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  await assert.rejects(() => service.update(1, { ...customerUpdate, fullName: '' }), error => (
    error.statusCode === 400 && error.message === 'Họ và tên không được để trống'
  ));
});

test('Không nhập số điện thoại khi cập nhật khách hàng', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  await assert.rejects(() => service.update(1, { ...customerUpdate, phone: '' }), error => (
    error.statusCode === 400 && error.message === 'Số điện thoại không được để trống'
  ));
});

test('Cập nhật khách hàng không tồn tại', async () => {
  const service = new CustomerService({ customerRepository: customerRepo({ findByIdWithDetails: async () => null }) });
  await assert.rejects(() => service.update(99999, customerUpdate), error => (
    error.statusCode === 404 && error.message === 'Không tìm thấy khách hàng'
  ));
});

function settlementService(items = []) {
  let received;
  const service = new RepairSettlementService({ repairSettlementRepository: {
    findAll: async filters => { received = filters; return items; },
    count: async () => items.length,
  } });
  return { service, received: () => received };
}

test('Xem lịch sử dịch vụ theo xe', async () => {
  const context = settlementService([{ id: 1 }]);
  assert.equal((await context.service.getAll({ customerId: 1, vehicleId: 2, status: 'all', page: 1, limit: 10 })).total, 1);
  assert.equal(context.received().vehicleId, 2);
});

test('Lọc lịch sử dịch vụ theo trạng thái và ngày', async () => {
  const context = settlementService([{ id: 1 }]);
  await context.service.getAll({ customerId: 1, status: 'invoiced', fromDate: '2026-01-01', toDate: '2026-09-10', page: 1, limit: 10 });
  assert.equal(context.received().status, 'invoiced');
  assert.equal(context.received().fromDate, '2026-01-01');
  assert.equal(context.received().toDate, '2026-09-10');
});

test('Khách hàng chưa có lịch sử dịch vụ', async () => {
  const { service } = settlementService();
  assert.equal((await service.getAll({ customerId: 1, status: 'all', page: 1, limit: 10 })).total, 0);
});
