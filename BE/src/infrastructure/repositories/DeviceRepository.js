const { query } = require('../database/sqlServer');

/**
 * Chuyen gia tri Date tu mssql thanh ISO8601 UTC string ('...Z').
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

let trustedSchemaReady = false;
let trustedSchemaPromise = null;

/** Dam bao cot is_trusted / trusted_at ton tai (idempotent). */
async function ensureTrustedSchema() {
  if (trustedSchemaReady) return;
  if (trustedSchemaPromise) return trustedSchemaPromise;
  trustedSchemaPromise = (async () => {
    try {
      await query(`
        IF COL_LENGTH('dbo.user_devices', 'is_trusted') IS NULL
        BEGIN
          ALTER TABLE dbo.user_devices
            ADD is_trusted BIT NOT NULL
              CONSTRAINT DF_user_devices_is_trusted DEFAULT (0);
        END
      `);
      await query(`
        IF COL_LENGTH('dbo.user_devices', 'trusted_at') IS NULL
        BEGIN
          ALTER TABLE dbo.user_devices ADD trusted_at DATETIME2 NULL;
        END
      `);
      trustedSchemaReady = true;
    } catch (err) {
      console.warn('[DeviceRepository] ensureTrustedSchema failed:', err.message);
      trustedSchemaPromise = null;
      throw err;
    }
  })();
  return trustedSchemaPromise;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name,
    deviceName: row.device_name,
    browser: row.browser,
    os: row.os,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    isCurrent: row.is_current === 1 || row.is_current === true,
    isTrusted: row.is_trusted === 1 || row.is_trusted === true,
    trustedAt: toIsoUtc(row.trusted_at),
    lastLoginAt: toIsoUtc(row.last_login_at),
    lastActivityAt: toIsoUtc(row.last_activity_at),
    createdAt: toIsoUtc(row.created_at),
  };
}

class DeviceRepository {
  async ensureSchema() {
    return ensureTrustedSchema();
  }

  async findByUserId(userId) {
    await ensureTrustedSchema();
    const result = await query(`
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address, d.user_agent,
        d.is_current, d.is_trusted, d.trusted_at, d.last_login_at, d.last_activity_at, d.created_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.user_id = @p1
      ORDER BY
        CASE WHEN d.is_trusted = 1 THEN 0 ELSE 1 END,
        CASE WHEN d.is_current = 1 THEN 0 ELSE 1 END,
        ISNULL(d.last_activity_at, d.last_login_at) DESC,
        d.last_login_at DESC
    `, { p1: userId });
    return result.recordset.map(mapRow);
  }

  async findActiveByUserId(userId) {
    await ensureTrustedSchema();
    const result = await query(`
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address,
        d.is_current, d.is_trusted, d.trusted_at, d.last_login_at, d.last_activity_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.user_id = @p1 AND d.is_current = 1
      ORDER BY ISNULL(d.last_activity_at, d.last_login_at) DESC, d.last_login_at DESC
    `, { p1: userId });
    return result.recordset.map((row) => ({
      id: Number(row.id),
      userId: row.user_id,
      userName: row.user_name,
      deviceName: row.device_name,
      browser: row.browser,
      os: row.os,
      ipAddress: row.ip_address,
      isCurrent: true,
      isTrusted: row.is_trusted === 1 || row.is_trusted === true,
      trustedAt: toIsoUtc(row.trusted_at),
      lastLoginAt: toIsoUtc(row.last_login_at),
      lastActivityAt: toIsoUtc(row.last_activity_at),
    }));
  }

  async findById(id) {
    await ensureTrustedSchema();
    const result = await query(`
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address, d.user_agent,
        d.is_current, d.is_trusted, d.trusted_at, d.last_login_at, d.last_activity_at, d.created_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.id = @p1
    `, { p1: id });
    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  }

  async findAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page = 1, pageSize = 20 }) {
    await ensureTrustedSchema();
    const conditions = ['1=1'];
    const params = {};
    let idx = 1;

    if (userId) {
      conditions.push(`d.user_id = @p${idx}`);
      params[`p${idx}`] = Number(userId);
      idx++;
    }

    if (search) {
      conditions.push(`(
        LOWER(u.user_name) LIKE LOWER(@p${idx})
        OR LOWER(u.first_name) LIKE LOWER(@p${idx})
        OR LOWER(u.last_name) LIKE LOWER(@p${idx})
        OR LOWER(d.device_name) LIKE LOWER(@p${idx})
        OR d.ip_address LIKE @p${idx}
        OR LOWER(d.browser) LIKE LOWER(@p${idx})
        OR LOWER(d.os) LIKE LOWER(@p${idx})
      )`);
      params[`p${idx}`] = `%${search}%`;
      idx++;
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
      conditions.push(`d.last_login_at >= @p${idx}`);
      params[`p${idx}`] = dateFrom;
      idx++;
    }

    if (dateTo) {
      conditions.push(`d.last_login_at <= @p${idx}`);
      params[`p${idx}`] = dateTo;
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM user_devices d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE ${where}`,
      params
    );

    const dataResult = await query(`
      SELECT
        d.id, d.user_id, d.device_name, d.browser, d.os, d.ip_address,
        d.is_current, d.is_trusted, d.trusted_at, d.last_login_at, d.last_activity_at,
        u.user_name, u.first_name, u.last_name, b.branch_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ${where}
      ORDER BY
        CASE WHEN d.is_trusted = 1 THEN 0 ELSE 1 END,
        CASE WHEN d.is_current = 1 THEN 0 ELSE 1 END,
        ISNULL(d.last_activity_at, d.last_login_at) DESC,
        d.last_login_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, { ...params, offset, pageSize });

    const items = dataResult.recordset.map((row) => ({
      id: Number(row.id),
      userId: row.user_id,
      userName: row.user_name,
      displayName: row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.user_name || null,
      branchName: row.branch_name,
      deviceName: row.device_name,
      browser: row.browser,
      os: row.os,
      ipAddress: row.ip_address,
      isCurrent: row.is_current === 1 || row.is_current === true,
      isTrusted: row.is_trusted === 1 || row.is_trusted === true,
      trustedAt: toIsoUtc(row.trusted_at),
      lastLoginAt: toIsoUtc(row.last_login_at),
      lastActivityAt: toIsoUtc(row.last_activity_at),
    }));

    return {
      items,
      total: Number(countResult.recordset[0].total),
      page,
      pageSize,
    };
  }

  async delete(id) {
    await query('DELETE FROM user_devices WHERE id = @p1', { p1: id });
  }

  async deleteOtherDevices(userId, currentDeviceId) {
    const result = await query(`
      DELETE FROM user_devices
      WHERE user_id = @p1
        AND (@p2 IS NULL OR id != @p2)
    `, { p1: userId, p2: currentDeviceId || null });
    return result.rowsAffected[0];
  }

  async deleteByUserAndIp(userId, ipAddress) {
    await query(
      `DELETE FROM user_devices WHERE user_id = @p1 AND ip_address = @p2`,
      { p1: userId, p2: ipAddress }
    );
  }

  async revokeAllDevices(userId) {
    await query(`
      UPDATE user_devices
      SET last_activity_at = SYSUTCDATETIME(), is_current = 0
      WHERE user_id = @p1 AND is_current = 1
    `, { p1: userId });
  }

  async countActiveByUserId(userId) {
    const result = await query(
      'SELECT COUNT(*) AS total FROM user_devices WHERE user_id = @p1 AND is_current = 1',
      { p1: userId }
    );
    return Number(result.recordset[0].total);
  }

  async updateLastActivityIfNeeded(deviceId) {
    const before = await query(
      `SELECT TOP 1 last_activity_at, is_current FROM user_devices WHERE id = @p1`,
      { p1: deviceId }
    );
    if (!before.recordset.length) return false;
    const row = before.recordset[0];
    const isCurrent = row.is_current === 1 || row.is_current === true;
    if (!isCurrent) return false;

    const now = Date.now();
    const lastMs = row.last_activity_at ? new Date(row.last_activity_at).getTime() : null;
    if (lastMs !== null && now - lastMs < 60_000) return false;

    await query(
      `UPDATE user_devices SET last_activity_at = SYSUTCDATETIME() WHERE id = @p1`,
      { p1: deviceId }
    );

    const after = await query(
      `SELECT TOP 1 last_activity_at FROM user_devices WHERE id = @p1`,
      { p1: deviceId }
    );
    const afterMs = after.recordset[0]?.last_activity_at
      ? new Date(after.recordset[0].last_activity_at).getTime()
      : null;
    if (!afterMs) return false;
    return lastMs === null || afterMs > lastMs;
  }
}

module.exports = DeviceRepository;
module.exports.ensureTrustedSchema = ensureTrustedSchema;
