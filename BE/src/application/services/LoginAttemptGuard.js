/**
 * Progressive lockout sau khi sai mật khẩu nhiều lần.
 * Sau 5 lần sai: chờ 10s; lần 6: 15s; 7: 20s; 8: 25s; từ 9+: 30s (max).
 * Key = identifier (email/phone) + IP.
 */
const attempts = new Map();

const FAIL_THRESHOLD = 5;
const BASE_WAIT_SEC = 10;
const STEP_SEC = 5;
const MAX_WAIT_SEC = 30;
const WINDOW_MS = 30 * 60 * 1000; // reset đếm sau 30 phút không sai

function _key(identifier, ip) {
  return `${String(identifier || '').trim().toLowerCase()}|${String(ip || '')}`;
}

function _waitSecondsForFailCount(failCount) {
  if (failCount < FAIL_THRESHOLD) return 0;
  // failCount=5 → 10s, 6→15, ... capped at 30
  return Math.min(MAX_WAIT_SEC, BASE_WAIT_SEC + (failCount - FAIL_THRESHOLD) * STEP_SEC);
}

function getState(identifier, ip) {
  const key = _key(identifier, ip);
  const row = attempts.get(key);
  if (!row) return { failCount: 0, lockedUntil: 0, waitSeconds: 0, remainingMs: 0 };
  if (Date.now() - row.firstFailAt > WINDOW_MS) {
    attempts.delete(key);
    return { failCount: 0, lockedUntil: 0, waitSeconds: 0, remainingMs: 0 };
  }
  const remainingMs = Math.max(0, (row.lockedUntil || 0) - Date.now());
  return {
    failCount: row.failCount,
    lockedUntil: row.lockedUntil || 0,
    waitSeconds: _waitSecondsForFailCount(row.failCount),
    remainingMs,
  };
}

function assertNotLocked(identifier, ip) {
  const state = getState(identifier, ip);
  if (state.remainingMs > 0) {
    const err = new Error(
      `Bạn đã nhập sai quá nhiều lần. Vui lòng đợi ${Math.ceil(state.remainingMs / 1000)}s rồi thử lại. Nên đổi mật khẩu nếu không phải bạn.`
    );
    err.statusCode = 429;
    err.code = 'LOGIN_LOCKED';
    err.details = {
      code: 'LOGIN_LOCKED',
      remainingMs: state.remainingMs,
      waitSeconds: Math.ceil(state.remainingMs / 1000),
      failCount: state.failCount,
      suggestChangePassword: true,
    };
    throw err;
  }
  return state;
}

function recordFailure(identifier, ip) {
  const key = _key(identifier, ip);
  const now = Date.now();
  let row = attempts.get(key);
  if (!row || now - row.firstFailAt > WINDOW_MS) {
    row = { failCount: 0, firstFailAt: now, lockedUntil: 0 };
  }
  row.failCount += 1;
  const waitSec = _waitSecondsForFailCount(row.failCount);
  row.lockedUntil = waitSec > 0 ? now + waitSec * 1000 : 0;
  attempts.set(key, row);
  return {
    failCount: row.failCount,
    waitSeconds: waitSec,
    remainingMs: Math.max(0, row.lockedUntil - now),
    suggestChangePassword: row.failCount >= FAIL_THRESHOLD,
  };
}

function clearFailures(identifier, ip) {
  attempts.delete(_key(identifier, ip));
}

module.exports = {
  assertNotLocked,
  recordFailure,
  clearFailures,
  getState,
  FAIL_THRESHOLD,
  MAX_WAIT_SEC,
};
