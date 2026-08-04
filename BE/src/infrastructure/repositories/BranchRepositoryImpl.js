const { query } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

class BranchRepositoryImpl {
  /**
   * Lay tat ca branches (full info, phuc vu admin page)
   * Tra ve tat ca rows, KHONG phan trang vi chi co 3 chi nhanh
   */
  async findAll() {
    const result = await query(`
      SELECT
        b.id,
        b.branch_code,
        b.branch_name,
        b.address,
        b.phone,
        b.email,
        b.manager_id,
        b.is_active,
        m.user_name  AS manager_user_name,
        m.first_name AS manager_first_name,
        m.last_name  AS manager_last_name,
        m.email      AS manager_email,
        m.status     AS manager_status
      FROM branches b
      LEFT JOIN users m ON m.id = b.manager_id
      ORDER BY b.branch_code ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      address: row.address,
      phone: row.phone,
      email: row.email,
      managerId: row.manager_id,
      managerName: [row.manager_first_name, row.manager_last_name].filter(Boolean).join(' ').trim()
        || row.manager_user_name
        || null,
      managerEmail: row.manager_email,
      managerStatus: row.manager_status,
      isActive: row.is_active === 1 || row.is_active === true,
    }));
  }

  /**
   * Lay 1 branch theo id
   */
  async findById(id) {
    const result = await query(`
      SELECT
        b.id,
        b.branch_code,
        b.branch_name,
        b.address,
        b.phone,
        b.email,
        b.manager_id,
        b.is_active,
        m.user_name  AS manager_user_name,
        m.first_name AS manager_first_name,
        m.last_name  AS manager_last_name,
        m.email      AS manager_email
      FROM branches b
      LEFT JOIN users m ON m.id = b.manager_id
      WHERE b.id = @p1
    `, { p1: id });

    const row = result.recordset[0];
    if (!row) return null;

    return {
      id: row.id,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      address: row.address,
      phone: row.phone,
      email: row.email,
      managerId: row.manager_id,
      managerName: [row.manager_first_name, row.manager_last_name].filter(Boolean).join(' ').trim()
        || row.manager_user_name
        || null,
      managerEmail: row.manager_email,
      isActive: row.is_active === 1 || row.is_active === true,
    };
  }

  /**
   * Lay danh sach user co role 'manager' de lam dropdown chon manager
   * Tra ve id + ten hien thi
   */
  async findManagerCandidates() {
    const result = await query(`
      SELECT u.id, u.user_name, u.first_name, u.last_name, u.email, u.status, b.branch_name
      FROM   users u
      JOIN   user_role ur ON ur.user_id = u.id
      JOIN   roles r     ON r.id       = ur.role_id
      LEFT   JOIN branches b ON b.id = u.branch_id
      WHERE  r.role_name = 'manager'
      ORDER  BY u.user_name ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      userName: row.user_name,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.user_name,
      email: row.email,
      status: row.status,
      branchName: row.branch_name || null,
    }));
  }

  /**
   * Lay danh sach user co role 'manager' CHUA co branch
   * (dung de gan them chi nhanh cho manager chua co branch)
   */
  async findUnassignedManagers() {
    const result = await query(`
      SELECT u.id, u.user_name, u.first_name, u.last_name, u.email, u.status
      FROM   users u
      JOIN   user_role ur ON ur.user_id = u.id
      JOIN   roles r     ON r.id       = ur.role_id
      WHERE  r.role_name = 'manager'
        AND (u.branch_id IS NULL OR u.branch_id NOT IN (SELECT id FROM branches WHERE is_active = 1))
      ORDER  BY u.user_name ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      userName: row.user_name,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.user_name,
      email: row.email,
      status: row.status,
    }));
  }

  /**
   * Kiem tra branch_code da ton tai chua
   */
  async findByCode(branchCode) {
    const result = await query(
      'SELECT id FROM branches WHERE branch_code = @p1',
      { p1: branchCode }
    );
    return result.recordset[0] || null;
  }

  /**
   * Tao branch moi
   */
  async create({ branchCode, branchName, address, phone, email, managerId }) {
    const result = await query(`
      INSERT INTO branches (branch_code, branch_name, address, phone, email, manager_id, is_active)
      OUTPUT INSERTED.id
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, 1)
    `, {
      p1: branchCode,
      p2: branchName,
      p3: address || null,
      p4: phone || null,
      p5: email || null,
      p6: managerId || null,
    });
    return result.recordset[0].id;
  }

  /**
   * Cap nhat branch
   */
  async update(id, { branchName, address, phone, email, managerId }) {
    const sets = ['branch_name = @p2'];
    const params = { p1: id, p2: branchName };
    let idx = 3;

    if (address !== undefined) {
      sets.push(`address = @p${idx}`);
      params[`p${idx}`] = address;
      idx++;
    }
    if (phone !== undefined) {
      sets.push(`phone = @p${idx}`);
      params[`p${idx}`] = phone;
      idx++;
    }
    if (email !== undefined) {
      sets.push(`email = @p${idx}`);
      params[`p${idx}`] = email;
      idx++;
    }
    if (managerId !== undefined) {
      sets.push(`manager_id = @p${idx}`);
      params[`p${idx}`] = managerId || null;
      idx++;
    }

    await query(`UPDATE branches SET ${sets.join(', ')} WHERE id = @p1`, params);
    return this.findById(id);
  }

  /**
   * Kich hoat / ngung hoat dong branch
   */
  async setActive(id, isActive) {
    await runInTransaction(async (tx) => {
      await tx
        .request()
        .input('branchId', Number(id))
        .input('isActive', isActive ? 1 : 0)
        .query('UPDATE branches SET is_active = @isActive WHERE id = @branchId');

      if (!isActive) {
        await tx
          .request()
          .input('branchId', Number(id))
          .query('UPDATE users SET token_version = token_version + 1 WHERE branch_id = @branchId');
      }
    });

    return this.findById(id);
  }

  /**
   * Thong ke chi nhanh: so user, so service_order, doanh thu 30 ngay
   */
  async getBranchStats(branchId) {
    const [userCount, orderCount, revenue] = await Promise.all([
      query(
        'SELECT COUNT(*) AS total FROM users WHERE branch_id = @p1',
        { p1: branchId }
      ),
      query(`
        SELECT COUNT(*) AS total
        FROM   service_orders so
        WHERE  so.branch_id = @p1
      `, { p1: branchId }),
      query(`
        SELECT ISNULL(SUM(so.total), 0) AS revenue
        FROM   service_orders so
        WHERE  so.branch_id = @p1
          AND  so.completed_date >= DATEADD(DAY, -30, GETDATE())
      `, { p1: branchId }),
    ]);

    return {
      userCount: Number(userCount.recordset[0].total),
      orderCount: Number(orderCount.recordset[0].total),
      revenue30Days: Number(revenue.recordset[0].revenue),
    };
  }
}

module.exports = BranchRepositoryImpl;
