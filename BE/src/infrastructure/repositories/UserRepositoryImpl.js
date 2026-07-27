const bcrypt = require('bcryptjs');
const UserRepository = require('../../domain/repositories/UserRepository');
const { query } = require('../database/sqlServer');
const User = require('../../domain/entities/User');

const USER_BASE_COLUMNS = `
  id,
  user_name,
  email,
  first_name,
  last_name,
  phone,
  branch_id,
  status,
  created_at
`;

function toUserEntity(row) {
  if (!row) return null;
  return User.fromPersistence({
    id: row.id,
    name: row.user_name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    branchId: row.branch_id,
    status: row.status,
    createdAt: row.created_at,
  });
}

class UserRepositoryImpl extends UserRepository {
  async findAll() {
    const result = await query(
      `SELECT ${USER_BASE_COLUMNS}
       FROM   users
       ORDER  BY id ASC`
    );
    return result.recordset.map(toUserEntity);
  }

  async findById(id) {
    const result = await query(
      `SELECT ${USER_BASE_COLUMNS}
       FROM   users
       WHERE  id = @id`,
      { id }
    );
    return toUserEntity(result.recordset[0]);
  }

  async findUserRoles(userId) {
    const result = await query(
      `SELECT r.role_name
       FROM   user_role ur
       JOIN   roles r ON r.id = ur.role_id
       WHERE  ur.user_id = @userId`,
      { userId }
    );
    return result.recordset.map((r) => r.role_name);
  }

  async findByEmail(email) {
    const result = await query(
      `SELECT id FROM users WHERE email = @email`,
      { email }
    );
    return result.recordset[0] || null;
  }

  async create(userData) {
    const hash = userData.user_password
      ? await bcrypt.hash(userData.user_password, 10)
      : null;

    const result = await query(
      `INSERT INTO users (user_name, email, user_password, first_name, last_name, phone, branch_id, status)
       OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email,
              INSERTED.first_name, INSERTED.last_name, INSERTED.phone, INSERTED.branch_id, INSERTED.status,
              INSERTED.created_at
       VALUES (@user_name, @email, @user_password, @first_name, @last_name, @phone, @branch_id, @status)`,
      {
        user_name: userData.name,
        email: userData.email,
        user_password: hash,
        first_name: userData.firstName ?? null,
        last_name: userData.lastName ?? null,
        phone: userData.phone ?? null,
        branch_id: userData.branchId ?? null,
        status: userData.status ?? 'active',
      }
    );
    return toUserEntity(result.recordset[0]);
  }

  async update(id, userData) {
    const result = await query(
      `UPDATE users
       SET    user_name  = @user_name,
              email      = @email,
              first_name = @first_name,
              last_name  = @last_name,
              phone      = @phone,
              branch_id  = @branch_id,
              status     = @status
       OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email,
              INSERTED.first_name, INSERTED.last_name, INSERTED.phone, INSERTED.branch_id, INSERTED.status,
              INSERTED.created_at
       WHERE  id = @id`,
      {
        id,
        user_name: userData.name,
        email: userData.email,
        first_name: userData.firstName ?? null,
        last_name: userData.lastName ?? null,
        phone: userData.phone ?? null,
        branch_id: userData.branchId ?? null,
        status: userData.status ?? 'active',
      }
    );
    return toUserEntity(result.recordset[0]);
  }

  async delete(id) {
    const result = await query(
      `DELETE FROM users
       OUTPUT DELETED.id, DELETED.user_name, DELETED.email,
              DELETED.first_name, DELETED.last_name, DELETED.phone, DELETED.branch_id, DELETED.status,
              DELETED.created_at
       WHERE  id = @id`,
      { id }
    );
    return toUserEntity(result.recordset[0]);
  }

  async attachRole(userId, roleName) {
    const roleResult = await query(
      `SELECT id FROM roles WHERE role_name = @roleName`,
      { roleName }
    );
    if (!roleResult.recordset[0]) return;
    const roleId = roleResult.recordset[0].id;
    await query(
      `IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = @userId AND role_id = @roleId)
       INSERT INTO user_role (user_id, role_id) VALUES (@userId, @roleId)`,
      { userId, roleId }
    );
  }

  async clearUserRoles(userId) {
    await query(
      `DELETE FROM user_role WHERE user_id = @userId`,
      { userId }
    );
  }
}

module.exports = UserRepositoryImpl;
