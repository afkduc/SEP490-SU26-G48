const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readAuditParamsFromSearch,
  writeAuditParamsToSearch,
} = require('../../src/utils/adminAuditParams');

// Report 5.1 — Admin Audit Logs (readAuditParamsFromSearch, writeAuditParamsToSearch)

test('readAuditParamsFromSearch UTCID01: text and numeric filters', () => {
  const sp = new URLSearchParams('keyword=Mai&action=UPDATE&branchId=3&responseStatus=403&page=2');
  assert.deepEqual(readAuditParamsFromSearch(sp), {
    keyword: 'Mai',
    action: 'UPDATE',
    branchId: 3,
    responseStatus: 403,
    page: 2,
  });
});

test('readAuditParamsFromSearch UTCID02: ignores empty and invalid numerics', () => {
  const sp = new URLSearchParams('keyword=&branchId=abc&page=NaN&ipAddress=::1');
  assert.deepEqual(readAuditParamsFromSearch(sp), { ipAddress: '::1' });
});

test('readAuditParamsFromSearch UTCID03: zero and decimals restored', () => {
  const sp = new URLSearchParams('branchId=0&responseStatus=0&page=0.5');
  assert.deepEqual(readAuditParamsFromSearch(sp), {
    branchId: 0,
    responseStatus: 0,
    page: 0.5,
  });
});

test('readAuditParamsFromSearch UTCID04–05: first value wins, unsupported keys ignored', () => {
  const sp = new URLSearchParams('keyword=a&keyword=b&page=1&sort=desc&token=secret');
  assert.deepEqual(readAuditParamsFromSearch(sp), { keyword: 'a', page: 1 });
});

test('readAuditParamsFromSearch UTCID06–07: empty and full supported set', () => {
  assert.deepEqual(readAuditParamsFromSearch(new URLSearchParams()), {});
  const qs = [
    'keyword=k', 'userName=u', 'phone=090', 'action=CREATE', 'tableName=users',
    'entityName=User', 'entityCode=U1', 'ipAddress=1.1.1.1', 'requestMethod=GET',
    'responseStatus=200', 'startDate=2024-01-01', 'endDate=2024-01-31', 'branchId=2', 'page=3',
  ].join('&');
  const out = readAuditParamsFromSearch(new URLSearchParams(qs));
  assert.equal(out.keyword, 'k');
  assert.equal(out.branchId, 2);
  assert.equal(out.page, 3);
  assert.equal(out.responseStatus, 200);
});

test('writeAuditParamsToSearch UTCID01: omits empty and default page 1', () => {
  const qs = writeAuditParamsToSearch({ keyword: 'Mai', action: '', branchId: 3, page: 1 });
  assert.equal(qs, 'keyword=Mai&branchId=3');
});

test('writeAuditParamsToSearch UTCID02: serializes all populated filters', () => {
  const qs = writeAuditParamsToSearch({
    keyword: 'x',
    userName: 'u',
    action: 'UPDATE',
    requestMethod: 'POST',
    responseStatus: 201,
    branchId: 1,
    page: 4,
  });
  const sp = new URLSearchParams(qs);
  assert.equal(sp.get('keyword'), 'x');
  assert.equal(sp.get('page'), '4');
  assert.equal(sp.get('responseStatus'), '201');
});

test('writeAuditParamsToSearch UTCID03/08: round-trip with readAuditParamsFromSearch', () => {
  const original = {
    keyword: 'audit',
    userName: 'Admin',
    phone: '0901234567',
    action: 'LOGIN',
    ipAddress: '10.0.0.8',
    branchId: 5,
    page: 2,
  };
  const restored = readAuditParamsFromSearch(new URLSearchParams(writeAuditParamsToSearch(original)));
  assert.equal(restored.keyword, original.keyword);
  assert.equal(restored.branchId, original.branchId);
  assert.equal(restored.page, original.page);
});

test('writeAuditParamsToSearch UTCID04–07: ignores extras, preserves zero, omits null/page rules', () => {
  const qs = writeAuditParamsToSearch({
    sort: 'desc',
    token: 'x',
    branchId: 0,
    responseStatus: 0,
    page: 0,
    keyword: null,
    action: undefined,
  });
  const sp = new URLSearchParams(qs);
  assert.equal(sp.get('branchId'), '0');
  assert.equal(sp.get('responseStatus'), '0');
  assert.equal(sp.get('page'), null);
  assert.equal(sp.get('keyword'), null);

  assert.equal(writeAuditParamsToSearch({ page: 2 }).includes('page=2'), true);
  assert.equal(writeAuditParamsToSearch({ page: 1 }).includes('page='), false);
});
