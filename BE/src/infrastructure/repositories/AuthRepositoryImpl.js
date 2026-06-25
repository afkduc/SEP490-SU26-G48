const AuthRepository = require('../../domain/repositories/AuthRepository');
const { query } = require('../database/sqlServer');

class AuthRepositoryImpl extends AuthRepository {
  async findUserByEmail(email) {
    const result = await query(
      `SELECT id, employee_code, user_name, email, user_password,
              first_name, last_name, phone, branch_id, status, avatar
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
}

module.exports = AuthRepositoryImpl;
