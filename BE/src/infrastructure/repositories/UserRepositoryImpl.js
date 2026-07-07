const UserRepository = require('../../domain/repositories/UserRepository');
const { query } = require('../database/sqlServer');
const User = require('../../domain/entities/User');

const USER_BASE_COLUMNS = `
  id,
  user_name,
  email,
  created_at
`;

function toUserEntity(row) {
  if (!row) return null;
  return User.fromPersistence({
    id: row.id,
    name: row.user_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.created_at,
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

  async create(userData) {
    const result = await query(
      `INSERT INTO users (user_name, email, user_password)
       OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email, INSERTED.created_at
       VALUES (@user_name, @email, @user_password)`,
      {
        user_name: userData.name,
        email: userData.email,
        user_password: userData.user_password,
      }
    );
    return toUserEntity(result.recordset[0]);
  }

  async update(id, userData) {
    const result = await query(
      `UPDATE users
       SET    user_name = @user_name,
              email     = @email
       OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email, INSERTED.created_at
       WHERE  id = @id`,
      {
        id,
        user_name: userData.name,
        email: userData.email,
      }
    );
    return toUserEntity(result.recordset[0]);
  }

  async delete(id) {
    const result = await query(
      `DELETE FROM users
       OUTPUT DELETED.id, DELETED.user_name, DELETED.email, DELETED.created_at
       WHERE  id = @id`,
      { id }
    );
    return toUserEntity(result.recordset[0]);
  }
}

module.exports = UserRepositoryImpl;
