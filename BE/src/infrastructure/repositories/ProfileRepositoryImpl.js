const { query } = require('../database/sqlServer');

// Cot chinh cua user (khong bao gom branchName - do ProfileBranchService
// Branch scope: users.branch_id (+ ProfileBranchService).
const PROFILE_COLUMNS = `
  u.id,
  u.user_name,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.branch_id,
  u.status,
  u.created_at,
  u.updated_at
`;

function toProfileRow(row, branchName, assignedBranches = []) {
  if (!row) return null;

  return {
    id: row.id,
    userName: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: branchName || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: [],
    assignedBranches,
  };
}

class ProfileRepositoryImpl {
  /**
   * Tra ve row thuc cua user (chua roles/branches).
   * Logic lay assignedBranches da duoc tach sang ProfileBranchService
   * va do Controller goi rieng -> sua ngay 22/07/2026.
   */
  async findById(userId) {
    const result = await query(
      `SELECT ${PROFILE_COLUMNS}
       FROM   users u
       WHERE  u.id = @p1`,
      { p1: userId }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const profile = toProfileRow(row, null, []);

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

  async findByPhone(phone) {
    const result = await query(
      `SELECT id, phone
       FROM   users
       WHERE  phone = @p1`,
      { p1: phone }
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

    // Set updated_at = SYSUTCDATETIME() de trigger khong can chay.
    // Tranh phu thuoc trigger (se hoat dong ngay ca khi trigger bi drop).
    if (updates.length > 0) {
      updates.push(`updated_at = SYSUTCDATETIME()`);
    } else {
      return this.findById(userId);
    }

    params[`p${p}`] = userId;
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = @p${p}`,
      params
    );

    return this.findById(userId);
  }

  async updatePassword(userId, passwordHash) {
    await query(
      `UPDATE users
       SET    user_password = @p1,
              updated_at    = SYSUTCDATETIME()
       WHERE  id = @p2`,
      { p1: passwordHash, p2: userId }
    );
  }
}

module.exports = ProfileRepositoryImpl;
