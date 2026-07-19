const AuthRepository = require('../../domain/repositories/AuthRepository');
const { query } = require('../database/sqlServer');

class AuthRepositoryImpl extends AuthRepository {
  async findUserByEmail(email) {
    const result = await query(
      `SELECT id, pseudo_id, user_name, email, user_password,
              first_name, last_name, phone, branch_id, status, avatar,
              must_change_password, token_version
       FROM   users
       WHERE  email = @email AND status = 'active'`,
      { email }
    );
    return result.recordset[0] || null;
  }

  async findUserRoles(userId) {
    const result = await query(
      `SELECT r.role_name, r.role_label
       FROM   user_role ur
       JOIN   roles r ON r.id = ur.role_id
       WHERE  ur.user_id = @userId`,
      { userId }
    );
    return result.recordset;
  }

  async incrementTokenVersion(userId) {
    await query(
      `UPDATE users SET token_version = token_version + 1 WHERE id = @userId`,
      { userId }
    );
    const result = await query(
      `SELECT token_version FROM users WHERE id = @userId`,
      { userId }
    );
    return result.recordset[0]?.token_version || null;
  }

  async getTokenVersion(userId) {
    const result = await query(
      `SELECT token_version FROM users WHERE id = @userId`,
      { userId }
    );
    return result.recordset[0]?.token_version || null;
  }
}

module.exports = AuthRepositoryImpl;
