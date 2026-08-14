const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferEntityLifecycleStep,
  seedLifecycleFromExisting,
  buildLifecycleDescription,
} = require('../../src/utils/auditLifecycleStep');

test('inferEntityLifecycleStep: create / delete / update mac dinh', () => {
  assert.deepEqual(inferEntityLifecycleStep({ kind: 'create' }), {
    step: 'created',
    stepLabel: 'Tạo mới',
    action: 'CREATE',
  });
  assert.equal(inferEntityLifecycleStep({ kind: 'delete' }).step, 'locked');
  assert.equal(inferEntityLifecycleStep({ kind: 'update', data: { name: 'A' } }).step, 'updated');
});

test('inferEntityLifecycleStep: khoa / kich hoat chi khi doi status', () => {
  const locked = inferEntityLifecycleStep({ kind: 'update', data: { status: 'inactive' } });
  assert.equal(locked.step, 'locked');
  assert.equal(locked.action, 'DELETE');

  const reactivated = inferEntityLifecycleStep({ kind: 'update', data: { isActive: true } });
  assert.equal(reactivated.step, 'reactivated');

  const lockedByDesc = inferEntityLifecycleStep({
    kind: 'update',
    description: 'Khóa tài khoản nhung a',
    data: { firstName: 'nhung', status: 'inactive' },
  });
  assert.equal(lockedByDesc.step, 'locked');

  const editKeepStatus = inferEntityLifecycleStep({
    kind: 'update',
    data: { name: 'Bugi', status: 'active' },
  });
  assert.equal(editKeepStatus.step, 'updated');
});

test('inferEntityLifecycleStep: nhan vien doi / khoang xe / duyet phieu', () => {
  assert.equal(
    inferEntityLifecycleStep({
      kind: 'update',
      description: 'Cập nhật thành viên đội của tổ trưởng #12',
    }).step,
    'team_members',
  );
  assert.equal(
    inferEntityLifecycleStep({
      kind: 'update',
      description: 'Cập nhật khoang xe phụ trách của tổ trưởng #12',
    }).step,
    'bays',
  );
  assert.equal(
    inferEntityLifecycleStep({
      kind: 'update',
      description: 'Duyệt phiếu nhập kho PN-1',
      data: { status: 'approved' },
    }).step,
    'approved',
  );
});

test('seedLifecycleFromExisting: giu steps neu da la lifecycle', () => {
  const existing = {
    new_value: JSON.stringify({
      lifecycle: true,
      steps: [{ step: 'created', label: 'Tạo mới' }],
      snapshot: { name: 'A' },
    }),
  };
  const seeded = seedLifecycleFromExisting(existing, []);
  assert.equal(seeded.steps.length, 1);
  assert.equal(seeded.snapshot.name, 'A');
});

test('seedLifecycleFromExisting: gom nhieu dong CRUD rac thanh steps', () => {
  const siblings = [
    {
      action: 'CREATE',
      description: 'Tạo mới Phụ tùng #83',
      user_name: 'Kho',
      logged_at: '2026-08-15T02:40:00.000Z',
      new_value: JSON.stringify({ productCode: 'PT-1' }),
    },
    {
      action: 'UPDATE',
      description: 'Cập nhật Phụ tùng #83',
      user_name: 'Kho',
      logged_at: '2026-08-15T02:47:11.000Z',
      new_value: JSON.stringify({ productCode: 'PT-1', name: 'Bugi' }),
    },
  ];
  const seeded = seedLifecycleFromExisting(siblings[0], siblings);
  assert.equal(seeded.steps.length, 2);
  assert.equal(seeded.steps[0].label, 'Tạo mới');
  assert.equal(seeded.steps[1].label, 'Cập nhật');
  assert.equal(seeded.snapshot.name, 'Bugi');
});

test('buildLifecycleDescription: them lich su khi co nhieu buoc', () => {
  assert.equal(buildLifecycleDescription('Cập nhật Phụ tùng PT-1', ['Tạo mới']), 'Cập nhật Phụ tùng PT-1');
  assert.equal(
    buildLifecycleDescription('Cập nhật Phụ tùng PT-1', ['Tạo mới', 'Cập nhật', 'Khóa / ngừng hoạt động']),
    'Cập nhật Phụ tùng PT-1 — Lịch sử: Tạo mới → Cập nhật → Khóa / ngừng hoạt động',
  );
  assert.equal(
    buildLifecycleDescription('X — Lịch sử: Tạo mới → Cập nhật', ['Tạo mới', 'Cập nhật', 'Khóa']),
    'X — Lịch sử: Tạo mới → Cập nhật',
  );
});
