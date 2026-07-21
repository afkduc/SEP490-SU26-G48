const { query } = require('../database/sqlServer');

// Cot chinh cua user (khong bao gom branchName - do query leftJoinUserBranches
// se add sau neu co row trong user_branches).
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

// Lay tat ca branch ma user duoc gan (qua junction user_branches).
// Tra ve: [{ branchId, branchName }]
async function leftJoinUserBranches(userId) {
  const result = await query(
    `SELECT ub.branch_id, b.branch_name
     FROM   user_branches ub
     LEFT   JOIN branches b ON b.id = ub.branch_id
     WHERE  ub.user_id = @p1
     ORDER  BY b.branch_name ASC`,
    { p1: userId }
  );
  return result.recordset.map((row) => ({
    branchId: row.branch_id,
    branchName: row.branch_name,
  }));
}

function toProfileRow(row, assignedBranches = []) {
  if (!row) return null;

  // Chon branchName theo thu tu uu tien:
  //   1. Neu user co 1 row duy nhat trong user_branches -> dung ten do
  //   2. Neu user co nhieu row trong user_branches -> join bang "Ten1, Ten2"
  //   3. Neu user_branches rong -> fallback users.branch_id (LEFT JOIN o query)
  let branchName = null;
  if (assignedBranches.length === 1) {
    branchName = assignedBranches[0].branchName;
  } else if (assignedBranches.length > 1) {
    branchName = assignedBranches.map((b) => b.branchName).filter(Boolean).join(', ');
  }

  return {
    id: row.id,
    userName: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    branchName: branchName || row.branch_name || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: [],
    assignedBranches,
  };
}

class ProfileRepositoryImpl {
  async findById(userId) {
    const result = await query(
      `SELECT ${PROFILE_COLUMNS}, b.branch_name
       FROM   users u
       LEFT   JOIN branches b ON b.id = u.branch_id
       WHERE  u.id = @p1`,
      { p1: userId }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const assignedBranches = await leftJoinUserBranches(userId);
    const profile = toProfileRow(row, assignedBranches);

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

  async updatePassword(userId, passwordHash, mustChangePassword = false) {
    await query(
      `UPDATE users
       SET    user_password         = @p1,
              must_change_password  = @p2,
              updated_at            = SYSUTCDATETIME()
       WHERE  id = @p3`,
      { p1: passwordHash, p2: mustChangePassword ? 1 : 0, p3: userId }
    );
  }
}

module.exports = ProfileRepositoryImpl;
