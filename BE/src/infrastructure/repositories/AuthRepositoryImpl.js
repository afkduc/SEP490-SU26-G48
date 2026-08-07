const AuthRepository = require('../../domain/repositories/AuthRepository');
const { query } = require('../database/sqlServer');

/** Chuẩn hóa SĐT VN: bỏ khoảng trắng/ký tự, +84/84 → 0xxxxxxxxx */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let p = raw.trim().replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = `0${p.slice(3)}`;
  else if (p.startsWith('84') && p.length >= 11) p = `0${p.slice(2)}`;
  return p;
}

class AuthRepositoryImpl extends AuthRepository {
  async findUserByEmail(email) {
    const result = await query(
      `SELECT u.id, u.pseudo_id, u.user_name, u.email, u.user_password,
              u.first_name, u.last_name, u.phone, u.branch_id, u.status,
              b.is_active AS branch_is_active,
              token_version
       FROM   users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE  LOWER(u.email) = LOWER(@email)`,
      { email }
    );
    return result.recordset[0] || null;
  }

  /**
   * Tìm user theo email hoặc số điện thoại.
   * @param {string} identifier
   */
  async findUserByEmailOrPhone(identifier) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;

    if (raw.includes('@')) {
      return this.findUserByEmail(raw);
    }

    const phone = normalizePhone(raw);
    if (!phone) return null;

    const result = await query(
      `SELECT u.id, u.pseudo_id, u.user_name, u.email, u.user_password,
              u.first_name, u.last_name, u.phone, u.branch_id, u.status,
              b.is_active AS branch_is_active,
              token_version
       FROM   users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE  REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(u.phone, ''), ' ', ''), '-', ''), '.', ''), '+84', '0') = @phone
          OR  REPLACE(REPLACE(REPLACE(ISNULL(u.phone, ''), ' ', ''), '-', ''), '.', '') = @phone`,
      { phone }
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

  async updatePassword(userId, passwordHash) {
    await query(
      `UPDATE users
       SET user_password = @p1,
           token_version = ISNULL(token_version, 0) + 1
       WHERE id = @p2`,
      { p1: passwordHash, p2: userId }
    );
  }
}

AuthRepositoryImpl.normalizePhone = normalizePhone;

module.exports = AuthRepositoryImpl;
