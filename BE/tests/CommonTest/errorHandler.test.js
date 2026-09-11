const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../../src/middlewares/errorHandler');
const ApiError = require('../../src/utils/ApiError');
const { sqlErrorMessage } = require('../../src/utils/sqlErrorMessage');

// errorHandler tra ve gi cho client - diem quan trong nhat la KHONG duoc de
// loi tho cua SQL Server lot ra ngoai (lo ten bang/cot/rang buoc, va nguoi
// dung doc cung khong hieu de xu ly).

function gia() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  const req = { method: 'POST', originalUrl: '/api/repair-settlements/126', user: { userId: 7 } };
  return { res, req };
}

// Tat log trong luc chay test - errorHandler co console.error/warn that.
function imLang(fn) {
  const { error: e, warn: w } = console;
  console.error = () => {}; console.warn = () => {};
  try { return fn(); } finally { console.error = e; console.warn = w; }
}

test('loi ApiError 4xx: giu nguyen thong diep da viet', () => {
  const { res, req } = gia();
  imLang(() => errorHandler(new ApiError(409, 'Phiếu đã chốt tiền'), req, res, () => {}));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'Phiếu đã chốt tiền');
});

// Chinh la loi da xay ra that: chon dich vu "Cham soc xe" -> INSERT vi pham
// CHECK constraint -> nguyen chuoi SQL hien len man hinh nguoi dung.
test('loi SQL Server: KHONG duoc lot chuoi goc ra client', () => {
  const { res, req } = gia();
  const loiSql = new Error(
    'The INSERT statement conflicted with the CHECK constraint "roi_repair_category_chk". '
    + 'The conflict occurred in database "AutoGaraDB", table "dbo.repair_order_items", '
    + "column 'repair_category'."
  );
  loiSql.name = 'RequestError';
  loiSql.number = 547;

  imLang(() => errorHandler(loiSql, req, res, () => {}));

  assert.equal(res.statusCode, 500);
  const msg = res.body.message;
  for (const loRi of ['roi_repair_category_chk', 'repair_order_items', 'AutoGaraDB', 'repair_category', 'INSERT']) {
    assert.ok(!msg.includes(loRi), `van con lo "${loRi}" trong: ${msg}`);
  }
  assert.match(msg, /không hợp lệ/);
  // Ma loi phai nam NGAY TRONG cau thong bao - man hinh chi hien message
  assert.match(res.body.code, /^[0-9A-F]{8}$/);
  assert.ok(msg.includes(res.body.code), 'ma loi phai co trong thong bao: ' + msg);
});

test('loi lap trinh (khong phai SQL): cung khong lot chi tiet ra client', () => {
  const { res, req } = gia();
  imLang(() => errorHandler(new TypeError("Cannot read properties of undefined (reading 'ten')"), req, res, () => {}));
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.message.includes('undefined'));
  assert.match(res.body.code, /^[0-9A-F]{8}$/);
});

test('moi loi 500 co 1 ma rieng de tra log', () => {
  const a = gia(); const b = gia();
  imLang(() => {
    errorHandler(new Error('x'), a.req, a.res, () => {});
    errorHandler(new Error('x'), b.req, b.res, () => {});
  });
  assert.notEqual(a.res.body.code, b.res.body.code);
});

// So hieu loi cua mssql khi thi nam o err.number, khi thi chui trong
// originalError.info.number (loi do tedious nem len).
test('sqlErrorMessage doc duoc so hieu loi long nhieu tang', () => {
  assert.match(sqlErrorMessage({ name: 'RequestError', number: 2627 }), /đã tồn tại/);
  assert.match(
    sqlErrorMessage({ name: 'RequestError', originalError: { info: { number: 515 } } }),
    /bắt buộc chưa được điền/
  );
  assert.match(sqlErrorMessage({ name: 'ConnectionError', code: 'ETIMEOUT' }), /quá chậm/);
});

test('sqlErrorMessage bo qua loi khong phai cua CSDL', () => {
  assert.equal(sqlErrorMessage(new TypeError('abc')), null);
  assert.equal(sqlErrorMessage(null), null);
});
