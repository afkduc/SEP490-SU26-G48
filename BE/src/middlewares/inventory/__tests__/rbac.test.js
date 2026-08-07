const test = require('node:test');
const assert = require('node:assert/strict');
const { can, ROLE_PERMISSIONS } = require('../rbac');

test('admin co moi quyen', () => {
  assert.equal(can('admin', 'parts:read'), true);
  assert.equal(can('admin', 'reports:read'), true);
});

test('warehouse_staff duoc nhap/xuat kho nhung khong duyet phieu', () => {
  assert.equal(can('warehouse_staff', 'stock:write'), true);
  assert.equal(can('warehouse_staff', 'import_requests:create'), true);
  assert.equal(can('warehouse_staff', 'import_requests:approve'), false);
});

test('manager duoc duyet phieu nhap nhung khong duoc tao phieu nhap', () => {
  assert.equal(can('manager', 'import_requests:approve'), true);
  assert.equal(can('manager', 'import_requests:create'), false);
  assert.equal(can('manager', 'reports:read'), true);
});

test('general_director chi duoc xem kho va khong duyet hay tao phieu nhap', () => {
  assert.equal(can('general_director', 'stock:read'), true);
  assert.equal(can('general_director', 'import_requests:create'), false);
  assert.equal(can('general_director', 'import_requests:approve'), false);
});

test('role khong ton tai thi tu choi', () => {
  assert.equal(can('ghost', 'parts:read'), false);
});

test('ROLE_PERMISSIONS co du role kho chinh', () => {
  for (const r of ['admin', 'general_director', 'manager', 'warehouse_staff']) {
    assert.ok(ROLE_PERMISSIONS[r], `thieu role ${r}`);
  }
  assert.equal(ROLE_PERMISSIONS.accountant, undefined);
});
