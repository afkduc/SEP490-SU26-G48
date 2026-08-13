const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startOfDayVN,
  endOfDayVN,
  parseUtcRangeFromVnDates,
} = require('../../src/utils/dateVN');

test('startOfDayVN: 00:00 VN = 17:00 UTC ngày trước', () => {
  assert.equal(startOfDayVN('2026-08-14').toISOString(), '2026-08-13T17:00:00.000Z');
});

test('endOfDayVN: 23:59:59.999 VN = 16:59:59.999 UTC cùng ngày', () => {
  assert.equal(endOfDayVN('2026-08-14').toISOString(), '2026-08-14T16:59:59.999Z');
});

test('parseUtcRangeFromVnDates: Hôm nay gồm log lúc 00:18 VN', () => {
  const { from, to, hasRange } = parseUtcRangeFromVnDates('2026-08-14', '2026-08-14');
  assert.equal(hasRange, true);
  const loggedAt = new Date('2026-08-13T17:18:00.000Z'); // 00:18 14/08 VN
  assert.ok(loggedAt >= from && loggedAt <= to);
});

test('parseUtcRangeFromVnDates: log 23:50 VN vẫn trong ngày', () => {
  const { from, to } = parseUtcRangeFromVnDates('2026-08-14', '2026-08-14');
  const loggedAt = new Date('2026-08-14T16:50:00.000Z'); // 23:50 14/08 VN
  assert.ok(loggedAt >= from && loggedAt <= to);
});

test('parseUtcRangeFromVnDates: log 23:50 ngày trước không lọt vào Hôm nay', () => {
  const { from, to } = parseUtcRangeFromVnDates('2026-08-14', '2026-08-14');
  const loggedAt = new Date('2026-08-13T16:50:00.000Z'); // 23:50 13/08 VN
  assert.ok(loggedAt < from || loggedAt > to);
});
