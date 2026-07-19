const { query } = require('../database/sqlServer');

/**
 * Chuyen gia tri Date tu mssql thanh ISO8601 UTC string ('...Z').
 * Boi vi sqlServer.js da cau hinh useUTC: true nen cac gia tri Date
 * tra ve o UTC. Ham nay chi dam bao output luon la ISO string de FE
 * parse de dang bang new Date(...) ma khong bi lech mu gio.
 */
function toIsoUtc(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    // Neu da la ISO co 'Z' hoac offset thi giu nguyen
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
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
    lastLoginAt: toIsoUtc(row.last_login_at),
    lastActivityAt: toIsoUtc(row.last_activity_at),
    createdAt: toIsoUtc(row.created_at),
  };
}

class DeviceRepository {
  /**
   * Lay tat ca devices cua 1 user
   */
  async findByUserId(userId) {
    const result = await query(`
      SELECT
        d.id,
        d.user_id,
        d.device_name,
        d.browser,
        d.os,
        d.ip_address,
        d.user_agent,
        d.is_current,
        d.last_login_at,
        d.last_activity_at,
        d.created_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.user_id = @p1
      ORDER BY 
        CASE WHEN d.is_current = 1 THEN 0 ELSE 1 END,
        ISNULL(d.last_activity_at, d.last_login_at) DESC,
        d.last_login_at DESC
    `, { p1: userId });
    return result.recordset.map(mapRow);
  }

  /**
   * Lay tat ca devices dang active (is_current = 1) cua 1 user
   */
  async findActiveByUserId(userId) {
    const result = await query(`
      SELECT
        d.id,
        d.user_id,
        d.device_name,
        d.browser,
        d.os,
        d.ip_address,
        d.is_current,
        d.last_login_at,
        d.last_activity_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.user_id = @p1 AND d.is_current = 1
      ORDER BY 
        ISNULL(d.last_activity_at, d.last_login_at) DESC,
        d.last_login_at DESC
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
      lastLoginAt: toIsoUtc(row.last_login_at),
      lastActivityAt: toIsoUtc(row.last_activity_at),
    }));
  }

  /**
   * Lay 1 device theo id. Dung cho forceLogout (truoc day phai goi findAll
   * voi pageSize:1000 de tim - rat ton kem).
   */
  async findById(id) {
    const result = await query(`
      SELECT
        d.id,
        d.user_id,
        d.device_name,
        d.browser,
        d.os,
        d.ip_address,
        d.user_agent,
        d.is_current,
        d.last_login_at,
        d.last_activity_at,
        d.created_at,
        u.user_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.id = @p1
    `, { p1: id });
    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  }

  /**
   * Lay tat ca devices cua tat ca user (admin overview)
   */
  async findAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page = 1, pageSize = 20 }) {
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
        d.id,
        d.user_id,
        d.device_name,
        d.browser,
        d.os,
        d.ip_address,
        d.is_current,
        d.last_login_at,
        d.last_activity_at,
        u.user_name,
        u.first_name,
        u.last_name,
        b.branch_name
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ${where}
      ORDER BY 
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

  /**
   * Xoa 1 device
   */
  async delete(id) {
    await query('DELETE FROM user_devices WHERE id = @p1', { p1: id });
  }

  /**
   * Xoa tat ca device cua 1 user tru device hien tai (is_current = 1)
   * Tra ve so device da xoa
   */
  async deleteOtherDevices(userId, currentDeviceId) {
    const result = await query(`
      DELETE FROM user_devices
      WHERE user_id = @p1
        AND (@p2 IS NULL OR id != @p2)
    `, { p1: userId, p2: currentDeviceId || null });
    return result.rowsAffected[0];
  }

  /**
   * Xoa device cua user tren 1 IP cu the
   */
  async deleteByUserAndIp(userId, ipAddress) {
    await query(
      `DELETE FROM user_devices WHERE user_id = @p1 AND ip_address = @p2`,
      { p1: userId, p2: ipAddress }
    );
  }

  /**
   * Revoke all devices of a user (set is_current = 0 for all).
   */
  async revokeAllDevices(userId) {
    await query(`
      UPDATE user_devices
      SET last_activity_at = SYSUTCDATETIME(), is_current = 0
      WHERE user_id = @p1 AND is_current = 1
    `, { p1: userId });
  }

  /**
   * Dem so device active cua user
   */
  async countActiveByUserId(userId) {
    const result = await query(
      'SELECT COUNT(*) AS total FROM user_devices WHERE user_id = @p1 AND is_current = 1',
      { p1: userId }
    );
    return Number(result.recordset[0].total);
  }

  /**
   * Update last_activity_at with 60s throttle.
   * Only updates if last_activity_at is NULL or >= 60 seconds ago.
   * Returns true if updated, false if skipped.
   *
   * QUAN TRONG: Bang user_devices co trigger INSTEAD OF UPDATE. Trigger
   * tu thuc hien UPDATE va set last_activity_at = SYSUTCDATETIME() neu
   * gia tri moi > now. Dieu nay khien:
   *   1. result.rowsAffected[0] luon = 0 (trigger chay thay the)
   *   2. Kho xac dinh duoc "co that su update hay khong" tu rowsAffected
   * Fix: SELECT gia tri last_activity_at TRUOC, doi chieu sau UPDATE de
   * xac dinh co thay doi khong (dung OUTPUT inserted.last_activity_at
   * cung bi trigger chan, nen phai lay gia tri cu de so sanh).
   */
  async updateLastActivityIfNeeded(deviceId) {
    // 1. Lay gia tri last_activity_at hien tai
    const before = await query(
      `SELECT TOP 1
         last_activity_at,
         is_current
       FROM user_devices
       WHERE id = @p1`,
      { p1: deviceId }
    );
    if (!before.recordset.length) return false;
    const row = before.recordset[0];
    // Neu khong phai device hien tai -> khong update
    const isCurrent = row.is_current === 1 || row.is_current === true;
    if (!isCurrent) return false;

    // 2. Kiem tra throttle: chi update neu NULL hoac >= 60s truoc
    const now = Date.now();
    const lastMs = row.last_activity_at ? new Date(row.last_activity_at).getTime() : null;
    if (lastMs !== null && now - lastMs < 60_000) return false;

    // 3. Thuc hien UPDATE (trigger INSTEAD OF se thuc hien UPDATE that su)
    //    rowsAffected se tra 0 nhung du lieu van update
    await query(
      `UPDATE user_devices
       SET last_activity_at = SYSUTCDATETIME()
       WHERE id = @p1`,
      { p1: deviceId }
    );

    // 4. Verify: SELECT lai de confirm thuc su da update
    const after = await query(
      `SELECT TOP 1 last_activity_at FROM user_devices WHERE id = @p1`,
      { p1: deviceId }
    );
    const afterMs = after.recordset[0]?.last_activity_at
      ? new Date(after.recordset[0].last_activity_at).getTime()
      : null;
    if (!afterMs) return false;
    // Cap nhat thanh cong neu gia tri moi khac gia tri cu (hoac cua bi NULL)
    return lastMs === null || afterMs > lastMs;
  }
}

module.exports = DeviceRepository;
