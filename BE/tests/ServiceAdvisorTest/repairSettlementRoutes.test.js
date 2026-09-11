const test = require('node:test');
const assert = require('node:assert/strict');
const buildRepairSettlementRouter = require('../../src/presentation/routes/repairSettlementRoutes');

// Ca router truoc day chi co `authenticate`, nen BAT KY tai khoan dang nhap nao
// (to truong, tho, thu kho...) cung tao/sua duoc phieu quyet toan - va nguoi
// tao TU DONG thanh co van dich vu cua phieu (advisor_id = req.user.userId).
// Da tao ra du lieu sai that: phieu RO-2026-089 ghi to truong lam co van.
//
// Test nay giu 2 dieu doi nghich nhau, de sau nay ai sua router con biet duong:
//   - duong GHI phai co chan vai tro
//   - duong DOC phai KHONG co, vi to truong (man "Khoang xe cua toi") va man
//     Lich su dich vu cua khach deu doc danh sach phieu.

function layTuyenDuong(router) {
  return router.stack
    .filter((lop) => lop.route)
    .map((lop) => ({
      duong: lop.route.path,
      phuongThuc: Object.keys(lop.route.methods)[0],
      soHandler: lop.route.stack.length,
    }));
}

const DUONG_GHI = [
  ['post', '/'],
  ['put', '/:id'],
  ['patch', '/:id/status'],
  ['patch', '/:id/tasks/:taskId/ng-decision'],
  ['post', '/:id/lock'],
  ['delete', '/:id/lock'],
  ['post', '/:id/payos/create-payment-link'],
];

const DUONG_DOC = [
  ['get', '/'],
  ['get', '/:id'],
  ['get', '/advisors'],
  ['get', '/:id/activity-log'],
];

test('moi duong GHI phieu quyet toan deu co chan vai tro', () => {
  const tuyen = layTuyenDuong(buildRepairSettlementRouter());
  for (const [phuongThuc, duong] of DUONG_GHI) {
    const t = tuyen.find((x) => x.duong === duong && x.phuongThuc === phuongThuc);
    assert.ok(t, `khong tim thay ${phuongThuc.toUpperCase()} ${duong}`);
    assert.ok(t.soHandler >= 2,
      `${phuongThuc.toUpperCase()} ${duong} chi co ${t.soHandler} handler - thieu chan vai tro`);
  }
});

test('duong DOC khong bi chan vai tro (to truong/lich su xe van doc duoc)', () => {
  const tuyen = layTuyenDuong(buildRepairSettlementRouter());
  for (const [phuongThuc, duong] of DUONG_DOC) {
    const t = tuyen.find((x) => x.duong === duong && x.phuongThuc === phuongThuc);
    assert.ok(t, `khong tim thay ${phuongThuc.toUpperCase()} ${duong}`);
    assert.equal(t.soHandler, 1,
      `${phuongThuc.toUpperCase()} ${duong} dang bi chan vai tro - to truong se khong doc duoc`);
  }
});

// "advisors" phai duoc khop TRUOC "/:id", khong thi Express coi no la 1 id.
test('/advisors dung truoc /:id', () => {
  const tuyen = layTuyenDuong(buildRepairSettlementRouter());
  const viTriAdvisors = tuyen.findIndex((x) => x.duong === '/advisors');
  const viTriId = tuyen.findIndex((x) => x.duong === '/:id' && x.phuongThuc === 'get');
  assert.ok(viTriAdvisors >= 0 && viTriId >= 0);
  assert.ok(viTriAdvisors < viTriId, '/advisors phai khai bao truoc /:id');
});
