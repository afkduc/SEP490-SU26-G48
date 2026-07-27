/**
 * In-memory store cho yêu cầu đăng nhập chờ xác nhận từ phiên đang active.
 * TTL mặc định 2 phút. Đủ cho 1 instance BE (DATN).
 */
const crypto = require('crypto');

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const store = new Map();

function _purgeExpired() {
  const now = Date.now();
  for (const [id, row] of store.entries()) {
    if (row.expiresAt <= now && row.status === 'pending') {
      row.status = 'expired';
    }
    if (row.expiresAt + 60_000 <= now) {
      store.delete(id);
    }
  }
}

function createPending(payload, ttlMs = DEFAULT_TTL_MS) {
  _purgeExpired();
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = {
    id,
    status: 'pending', // pending | approved | rejected | expired | completed
    createdAt: now,
    expiresAt: now + ttlMs,
    result: null,
    ...payload,
  };
  store.set(id, row);
  return row;
}

function getPending(id) {
  _purgeExpired();
  return store.get(id) || null;
}

function updatePending(id, patch) {
  const row = store.get(id);
  if (!row) return null;
  Object.assign(row, patch);
  store.set(id, row);
  return row;
}

function listPendingForUser(userId) {
  _purgeExpired();
  const uid = String(userId);
  return [...store.values()].filter(
    (r) => String(r.userId) === uid && r.status === 'pending' && r.expiresAt > Date.now()
  );
}

module.exports = {
  createPending,
  getPending,
  updatePending,
  listPendingForUser,
  DEFAULT_TTL_MS,
};
