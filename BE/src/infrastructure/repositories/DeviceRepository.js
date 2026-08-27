const { query } = require('../database/sqlServer');
const {
  sqlAccentInsensitiveLike,
  bindNormalizedLikeParam,
  bindPhoneDigitsLikeParam,
  sqlPhoneDigitsLike,
} = require('../../utils/vietnamese');

/**
 * Thiết bị = phiên LOGIN trên login_sessions (đã gộp bỏ user_devices).
 * - id / deviceId JWT = login_sessions.id
 * - is_current = (status = 'active')
 * - Danh sách admin: 1 dòng / (user + ip + browser + os) lấy phiên mới nhất
 */

function toIsoUtc(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
}

let schemaReady = false;
let schemaPromise = null;

/** Đảm bảo cột device_* trên login_sessions (idempotent). */
async function ensureSessionDeviceSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      await query(`
        IF COL_LENGTH('dbo.login_sessions', 'device_name') IS NULL
        BEGIN
          ALTER TABLE dbo.login_sessions ADD device_name NVARCHAR(255) NULL;
        END
      `);
      await query(`
        IF COL_LENGTH('dbo.login_sessions', 'is_trusted') IS NULL
        BEGIN
          ALTER TABLE dbo.login_sessions
            ADD is_trusted BIT NOT NULL
              CONSTRAINT DF_login_sessions_is_trusted DEFAULT (0);
        END
      `);
      await query(`
        IF COL_LENGTH('dbo.login_sessions', 'trusted_at') IS NULL
        BEGIN
          ALTER TABLE dbo.login_sessions ADD trusted_at DATETIME2 NULL;
        END
      `);
      schemaReady = true;
    } catch (err) {
      console.warn('[DeviceRepository] ensureSessionDeviceSchema failed:', err.message);
      schemaPromise = null;
      throw err;
    }
  })();
  return schemaPromise;
}

function mapRow(row) {
  const isCurrent = row.is_current === 1 || row.is_current === true
    || String(row.status || '').toLowerCase() === 'active';
  const browser = row.browser || null;
  const os = row.os || null;
  const deviceName = row.device_name
    || ([browser, os].filter(Boolean).join(' on ') || 'Unknown');
  return {
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name,
    deviceName,
    browser,
    os,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    isCurrent,
    isTrusted: row.is_trusted === 1 || row.is_trusted === true,
    trustedAt: toIsoUtc(row.trusted_at),
    lastLoginAt: toIsoUtc(row.login_time || row.last_login_at),
    lastActivityAt: toIsoUtc(row.last_activity_at),
    createdAt: toIsoUtc(row.login_time || row.created_at),
  };
}

/** CTE: 1 đại diện / fingerprint (user+ip+browser+os). */
const RANKED_DEVICES_CTE = `
  ranked_devices AS (
    SELECT
      ls.id,
      ls.user_id,
      ls.ip_address,
      ls.user_agent,
      ls.browser,
      ls.os,
      ls.status,
      ls.login_time,
      ls.last_activity_at,
      ls.is_trusted,
      ls.trusted_at,
      ls.device_name,
      CASE WHEN ls.status = N'active' THEN 1 ELSE 0 END AS is_current,
      ROW_NUMBER() OVER (
        PARTITION BY ls.user_id,
          ISNULL(ls.ip_address, N''),
          ISNULL(ls.browser, N''),
          ISNULL(ls.os, N'')
        ORDER BY
          CASE WHEN ls.status = N'active' THEN 0 ELSE 1 END,
          COALESCE(ls.last_activity_at, ls.login_time) DESC,
          ls.id DESC
      ) AS rn
    FROM login_sessions ls
    WHERE ls.action_type = N'LOGIN'
  )
`;

class DeviceRepository {
  async ensureSchema() {
    return ensureSessionDeviceSchema();
  }

  async findByUserId(userId) {
    await ensureSessionDeviceSchema();
    const result = await query(`
      WITH ${RANKED_DEVICES_CTE}
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address, d.user_agent,
        d.is_current, d.is_trusted, d.trusted_at, d.login_time, d.last_activity_at, d.status,
        u.user_name
      FROM ranked_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.rn = 1 AND d.user_id = @p1
      ORDER BY
        CASE WHEN d.is_trusted = 1 THEN 0 ELSE 1 END,
        CASE WHEN d.is_current = 1 THEN 0 ELSE 1 END,
        ISNULL(d.last_activity_at, d.login_time) DESC,
        d.login_time DESC
    `, { p1: userId });
    return result.recordset.map(mapRow);
  }

  async findActiveByUserId(userId) {
    await ensureSessionDeviceSchema();
    const result = await query(`
      SELECT
        ls.id, ls.user_id, ls.device_name, ls.browser, ls.os, ls.ip_address,
        1 AS is_current, ls.is_trusted, ls.trusted_at, ls.login_time, ls.last_activity_at,
        ls.status, u.user_name
      FROM login_sessions ls
      LEFT JOIN users u ON u.id = ls.user_id
      WHERE ls.user_id = @p1
        AND ls.status = N'active'
        AND ls.action_type = N'LOGIN'
      ORDER BY ISNULL(ls.last_activity_at, ls.login_time) DESC, ls.login_time DESC
    `, { p1: userId });
    return result.recordset.map(mapRow);
  }

  async findById(id) {
    await ensureSessionDeviceSchema();
    const result = await query(`
      SELECT
        ls.id, ls.user_id, ls.device_name, ls.browser, ls.os, ls.ip_address, ls.user_agent,
        CASE WHEN ls.status = N'active' THEN 1 ELSE 0 END AS is_current,
        ls.is_trusted, ls.trusted_at, ls.login_time, ls.last_activity_at, ls.status,
        u.user_name
      FROM login_sessions ls
      LEFT JOIN users u ON u.id = ls.user_id
      WHERE ls.id = @p1 AND ls.action_type = N'LOGIN'
    `, { p1: id });
    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  }

  async findAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page = 1, pageSize = 20 }) {
    await ensureSessionDeviceSchema();
    const conditions = ['d.rn = 1'];
    const params = {};
    let idx = 1;

    if (userId) {
      conditions.push(`d.user_id = @p${idx}`);
      params[`p${idx}`] = Number(userId);
      idx++;
    }

    if (search) {
      const key = `p${idx}`;
      bindNormalizedLikeParam(params, key, search);
      const parts = [
        sqlAccentInsensitiveLike('u.user_name', key),
        sqlAccentInsensitiveLike('u.email', key),
        sqlAccentInsensitiveLike('u.first_name', key),
        sqlAccentInsensitiveLike('u.last_name', key),
        sqlAccentInsensitiveLike(`(COALESCE(u.first_name, N'') + N' ' + COALESCE(u.last_name, N''))`, key),
        sqlAccentInsensitiveLike('d.device_name', key),
        `d.ip_address LIKE @${key}`,
        sqlAccentInsensitiveLike('d.browser', key),
        sqlAccentInsensitiveLike('d.os', key),
      ];
      idx += 1;
      const phoneKey = `p${idx}`;
      if (bindPhoneDigitsLikeParam(params, phoneKey, search)) {
        parts.push(sqlPhoneDigitsLike('u.phone', phoneKey));
        idx += 1;
      }
      conditions.push(`(${parts.join(' OR ')})`);
    }

    if (browser) {
      conditions.push(`LOWER(d.browser) LIKE LOWER(@p${idx})`);
      params[`p${idx}`] = `%${browser}%`;
      idx++;
    }

    if (os) {
      conditions.push(`LOWER(d.os) LIKE LOWER(@p${idx})`);
      params[`p${idx}`] = `%${os}%`;
      idx++;
    }

    if (isCurrent !== undefined && isCurrent !== null && String(isCurrent).trim() !== '') {
      const val = String(isCurrent).toLowerCase() === 'true' || isCurrent === true || isCurrent === '1' ? 1 : 0;
      conditions.push(`d.is_current = @p${idx}`);
      params[`p${idx}`] = val;
      idx++;
    }

    if (dateFrom) {
      conditions.push(`d.login_time >= @p${idx}`);
      params[`p${idx}`] = dateFrom;
      idx++;
    }

    if (dateTo) {
      conditions.push(`d.login_time <= @p${idx}`);
      params[`p${idx}`] = dateTo;
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    const countResult = await query(
      `WITH ${RANKED_DEVICES_CTE}
       SELECT COUNT(*) AS total
       FROM ranked_devices d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE ${where}`,
      params
    );

    const dataResult = await query(`
      WITH ${RANKED_DEVICES_CTE}
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address,
        d.is_current, d.is_trusted, d.trusted_at, d.login_time, d.last_activity_at, d.status,
        u.user_name, u.first_name, u.last_name, b.branch_name
      FROM ranked_devices d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ${where}
      ORDER BY
        CASE WHEN d.is_trusted = 1 THEN 0 ELSE 1 END,
        CASE WHEN d.is_current = 1 THEN 0 ELSE 1 END,
        ISNULL(d.last_activity_at, d.login_time) DESC,
        d.login_time DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, { ...params, offset, pageSize });

    const items = dataResult.recordset.map((row) => ({
      ...mapRow(row),
      displayName: row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.user_name || null,
      branchName: row.branch_name,
    }));

    return {
      items,
      total: Number(countResult.recordset[0].total),
      page,
      pageSize,
    };
  }

  /** Không còn bảng riêng — “xóa thiết bị” = đóng phiên nếu còn active. */
  async delete(id) {
    await query(`
      UPDATE login_sessions
      SET    logout_time = SYSUTCDATETIME(),
             logout_reason = N'DEVICE_DELETED',
             session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
             status = N'ended'
      WHERE  id = @p1 AND status = N'active' AND action_type = N'LOGIN'
    `, { p1: id });
  }

  async deleteOtherDevices(userId, currentSessionId) {
    const result = await query(`
      UPDATE login_sessions
      SET    logout_time = SYSUTCDATETIME(),
             logout_reason = N'DEVICE_DELETED',
             session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
             status = N'ended'
      WHERE  user_id = @p1
        AND  status = N'active'
        AND  action_type = N'LOGIN'
        AND  (@p2 IS NULL OR id != @p2)
    `, { p1: userId, p2: currentSessionId || null });
    return result.rowsAffected[0];
  }

  async deleteByUserAndIp(userId, ipAddress) {
    await query(`
      UPDATE login_sessions
      SET    logout_time = SYSUTCDATETIME(),
             logout_reason = N'DEVICE_DELETED',
             session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
             status = N'ended'
      WHERE  user_id = @p1
        AND  ip_address = @p2
        AND  status = N'active'
        AND  action_type = N'LOGIN'
    `, { p1: userId, p2: ipAddress });
  }

  async revokeAllDevices(userId) {
    await query(`
      UPDATE login_sessions
      SET    logout_time = SYSUTCDATETIME(),
             logout_reason = N'FORCE_LOGO',
             session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
             status = N'ended',
             last_activity_at = SYSUTCDATETIME()
      WHERE  user_id = @p1
        AND  status = N'active'
        AND  action_type = N'LOGIN'
    `, { p1: userId });
  }

  async countActiveByUserId(userId) {
    const result = await query(
      `SELECT COUNT(*) AS total FROM login_sessions
       WHERE user_id = @p1 AND status = N'active' AND action_type = N'LOGIN'`,
      { p1: userId }
    );
    return Number(result.recordset[0].total);
  }

  async updateLastActivityIfNeeded(sessionId) {
    const before = await query(
      `SELECT TOP 1 last_activity_at, status FROM login_sessions WHERE id = @p1 AND action_type = N'LOGIN'`,
      { p1: sessionId }
    );
    if (!before.recordset.length) return false;
    const row = before.recordset[0];
    if (String(row.status || '').toLowerCase() !== 'active') return false;

    const now = Date.now();
    const lastMs = row.last_activity_at ? new Date(row.last_activity_at).getTime() : null;
    if (lastMs !== null && now - lastMs < 60_000) return false;

    await query(
      `UPDATE login_sessions SET last_activity_at = SYSUTCDATETIME() WHERE id = @p1`,
      { p1: sessionId }
    );

    const after = await query(
      `SELECT TOP 1 last_activity_at FROM login_sessions WHERE id = @p1`,
      { p1: sessionId }
    );
    const afterMs = after.recordset[0]?.last_activity_at
      ? new Date(after.recordset[0].last_activity_at).getTime()
      : null;
    if (!afterMs) return false;
    return lastMs === null || afterMs > lastMs;
  }
}

module.exports = DeviceRepository;
module.exports.ensureTrustedSchema = ensureSessionDeviceSchema;
module.exports.ensureSessionDeviceSchema = ensureSessionDeviceSchema;
