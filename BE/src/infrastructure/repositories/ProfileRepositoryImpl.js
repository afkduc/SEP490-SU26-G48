const { query } = require('../database/sqlServer');

const PROFILE_COLUMNS = `
  u.id,
  u.user_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.branch_id,
  b.branch_name,
  u.status,
  u.created_at
`;

function toProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userName: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: row.branch_name,
    status: row.status,
    createdAt: row.created_at,
    roles: [],
  };
}

class ProfileRepositoryImpl {
  async findById(userId) {
    const result = await query(
      `SELECT ${PROFILE_COLUMNS}
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  u.id = @p1`,
      { p1: userId }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const profile = toProfileRow(row);

    const rolesResult = await query(
      `SELECT r.role_name, r.role_label
       FROM   user_role ur
       JOIN   roles r ON r.id = ur.role_id
       WHERE  ur.user_id = @p1`,
      { p1: userId }
    );
    profile.roles = rolesResult.recordset.map((r) => ({
      name: r.role_name,
      label: r.role_label,
    }));

    return profile;
  }

  async findByIdWithPassword(userId) {
    const result = await query(
      `SELECT id, user_password
       FROM   users
       WHERE  id = @p1`,
      { p1: userId }
    );
    return result.recordset[0] || null;
  }

  async findByEmail(email) {
    const result = await query(
      `SELECT id, email
       FROM   users
       WHERE  email = @p1`,
      { p1: email }
    );
    return result.recordset[0] || null;
  }

  async update(userId, { email, firstName, lastName, phone }) {
    const updates = [];
    const params = {};
    let p = 1;

    if (email !== undefined && email !== null && email !== '') {
      updates.push(`email = @p${p}`);
      params[`p${p}`] = email;
      p++;
    }
    if (firstName !== undefined) {
      updates.push(`first_name = @p${p}`);
      params[`p${p}`] = firstName;
      p++;
    }
    if (lastName !== undefined) {
      updates.push(`last_name = @p${p}`);
      params[`p${p}`] = lastName;
      p++;
    }
    if (phone !== undefined) {
      updates.push(`phone = @p${p}`);
      params[`p${p}`] = phone || null;
      p++;
    }

    if (updates.length === 0) {
      return this.findById(userId);
    }

    params[`p${p}`] = userId;
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = @p${p}`,
      params
    );

    return this.findById(userId);
  }

  async updatePassword(userId, passwordHash, mustChangePassword = false) {
    await query(
      `UPDATE users
       SET    user_password         = @p1,
              must_change_password  = @p2
       WHERE  id = @p3`,
      { p1: passwordHash, p2: mustChangePassword ? 1 : 0, p3: userId }
    );
  }
}

module.exports = ProfileRepositoryImpl;
