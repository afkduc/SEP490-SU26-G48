const { query } = require('../database/sqlServer');

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
    return result.recordset.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      deviceName: row.device_name,
      browser: row.browser,
      os: row.os,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isCurrent: row.is_current === 1 || row.is_current === true,
      lastLoginAt: row.last_login_at,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
    }));
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
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      deviceName: row.device_name,
      browser: row.browser,
      os: row.os,
      ipAddress: row.ip_address,
      isCurrent: true,
      lastLoginAt: row.last_login_at,
      lastActivityAt: row.last_activity_at,
    }));
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
      lastLoginAt: row.last_login_at,
      lastActivityAt: row.last_activity_at,
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
   */
  async updateLastActivityIfNeeded(deviceId) {
    const result = await query(
      `UPDATE user_devices
       SET last_activity_at = SYSUTCDATETIME()
       WHERE id = @p1
         AND is_current = 1
         AND (
           last_activity_at IS NULL
           OR DATEDIFF_BIG(SECOND, last_activity_at, SYSUTCDATETIME()) >= 60
         )`,
      { p1: deviceId }
    );
    return result.rowsAffected[0] > 0;
  }
}

module.exports = DeviceRepository;
