const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAlertMeta,
  describeAlertFocus,
  buildSessionSeedFromAlert,
  pickLatestSession,
  pickLatestDevice,
} = require('../../src/utils/adminLoginSecurity');

// Report 5.1 — Admin Login Security (parseAlertMeta, describeAlertFocus, buildSessionSeed, pickLatest*)

test('parseAlertMeta UTCID01: object metadata returned as-is', () => {
  const meta = { ipAddress: '10.0.0.8' };
  assert.equal(parseAlertMeta(meta), meta);
});

test('parseAlertMeta UTCID02: valid JSON parsed, invalid/null → {}', () => {
  assert.deepEqual(parseAlertMeta('{"ip":"::1"}'), { ip: '::1' });
  assert.deepEqual(parseAlertMeta('{invalid}'), {});
  assert.deepEqual(parseAlertMeta(null), {});
});

test('parseAlertMeta UTCID03–04: JSON object, array, primitive', () => {
  assert.deepEqual(parseAlertMeta('{"ip":"::1","attempts":3}'), { ip: '::1', attempts: 3 });
  assert.deepEqual(parseAlertMeta('[1,2,3]'), [1, 2, 3]);
  assert.equal(parseAlertMeta('true'), true);
  assert.equal(parseAlertMeta('42'), 42);
});

test('parseAlertMeta UTCID05–07: malformed, nested, no mutation', () => {
  assert.deepEqual(parseAlertMeta('   '), {});
  assert.deepEqual(parseAlertMeta('{"a":{"b":[1]}}'), { a: { b: [1] } });
  const obj = { nested: { x: 1 } };
  assert.equal(parseAlertMeta(obj), obj);
});

test('describeAlertFocus UTCID01: rule + user + IP', () => {
  const label = describeAlertFocus({
    ruleKey: 'new_device_ip',
    userName: 'Admin Amin',
    metadata: { ipAddress: '::1' },
  });
  assert.match(label, /thiết bị mới/i);
  assert.match(label, /Admin Amin/);
  assert.match(label, /::1/);
});

test('describeAlertFocus UTCID02: null alert → empty string', () => {
  assert.equal(describeAlertFocus(null), '');
  assert.equal(describeAlertFocus(undefined), '');
});

test('describeAlertFocus UTCID03–05: metadata fallbacks', () => {
  assert.match(
    describeAlertFocus({ ruleKey: 'new_device_ip', metadata: { userName: 'Meta User', ip: '1.2.3.4' } }),
    /Meta User/,
  );
  assert.match(describeAlertFocus({ ruleKey: 'x', displayName: 'Mai User' }), /Mai User/);
  assert.match(describeAlertFocus({ ruleKey: 'x', userId: 42 }), /#42/);
});

test('describeAlertFocus UTCID06–07: title and unmapped ruleKey', () => {
  assert.match(
    describeAlertFocus({ title: 'Custom alert', userName: 'A', metadata: {} }),
    /Custom alert · A/,
  );
  assert.match(describeAlertFocus({ ruleKey: 'unknown_rule_xyz' }), /unknown_rule_xyz/);
});

test('buildSessionSeedFromAlert: session_takeover, failed_login_burst, new_device_ip', () => {
  const takeover = buildSessionSeedFromAlert({
    ruleKey: 'session_takeover',
    userName: 'UserA',
    metadata: { ipAddress: '10.0.0.1' },
  });
  assert.equal(takeover.actionType, 'LOGIN');
  assert.equal(takeover.userName, 'UserA');
  assert.equal(takeover.preferLatest, true);
  assert.equal(takeover.sessionId, null);

  const burst = buildSessionSeedFromAlert({
    ruleKey: 'failed_login_burst',
    metadata: { ipAddress: '::1' },
  });
  assert.equal(burst.actionType, 'LOGIN_FAILED');
  assert.equal(burst.ipAddress, '::1');
  assert.equal(burst.userName, '');

  const newDev = buildSessionSeedFromAlert({
    ruleKey: 'new_device_ip',
    userName: 'Amin',
    metadata: { ip: '127.0.0.1' },
  });
  assert.equal(newDev.userName, 'Amin');
  assert.equal(newDev.ipAddress, '127.0.0.1');
  assert.equal(newDev.actionType, '');
});

test('buildSessionSeedFromAlert: trims padded values, ignores old sessionId, null alert', () => {
  const seed = buildSessionSeedFromAlert({
    ruleKey: 'inactive_admin',
    userName: '  Padded  ',
    metadata: { ipAddress: '  10.0.0.8  ', sessionId: 999 },
  });
  assert.equal(seed.userName, 'Padded');
  assert.equal(seed.focusIp, '10.0.0.8');
  assert.equal(seed.sessionId, null);
  assert.equal(seed.focusSessionId, null);
  assert.equal(buildSessionSeedFromAlert(null), null);
});

test('pickLatestSession: IP match, fallback, tie-break by id', () => {
  const t = '2024-01-01T10:00:00Z';
  const list = [
    { id: 10, ip_address: 'A', login_time: t },
    { id: 11, ip_address: 'A', login_time: t },
    { id: 5, ip_address: 'B', login_time: '2024-06-01T10:00:00Z' },
  ];
  assert.equal(pickLatestSession(list, { ip: 'A' }).id, 11);
  assert.equal(pickLatestSession(list, { ip: 'Z' }).id, 5);
  assert.equal(pickLatestSession(list, { ip: '  ' }).id, 5);
  assert.equal(pickLatestSession([], { ip: 'A' }), null);
  assert.equal(pickLatestSession(null), null);

  const byCreated = [
    { id: 1, ipAddress: 'X', createdAt: '2024-01-01' },
    { id: 2, ipAddress: 'X', createdAt: '2024-02-01' },
  ];
  assert.equal(pickLatestSession(byCreated).id, 2);

  const badTime = [
    { id: 3, loginTime: 'not-a-date' },
    { id: 4, loginTime: 'also-bad' },
  ];
  assert.equal(pickLatestSession(badTime).id, 4);
});

test('pickLatestDevice: IP priority, max timestamp, tie-break', () => {
  const list = [
    { id: 1, ipAddress: '::1', lastActivityAt: '2024-01-01', lastLoginAt: '2024-01-02' },
    { id: 2, ipAddress: '::1', lastActivityAt: '2024-06-01' },
    { id: 3, ipAddress: 'other', lastActivityAt: '2025-01-01' },
  ];
  assert.equal(pickLatestDevice(list, { ip: '::1' }).id, 2);
  assert.equal(pickLatestDevice(list, { ip: 'none' }).id, 3);

  const tie = [
    { id: 3, createdAt: '2024-01-01' },
    { id: 4, createdAt: '2024-01-01' },
  ];
  assert.equal(pickLatestDevice(tie).id, 4);
  assert.equal(pickLatestDevice(null), null);
  assert.equal(pickLatestDevice([]), null);
});
