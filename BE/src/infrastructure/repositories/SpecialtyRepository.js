const { query } = require('../database/sqlServer');

class SpecialtyRepository {
  /**
   * Lay tat ca specialties
   */
  async findAll() {
    const result = await query(`
      SELECT id, specialty_code, specialty_name, created_at
      FROM specialties
      ORDER BY specialty_code ASC
    `);
    return result.recordset.map((row) => ({
      id: row.id,
      specialtyCode: row.specialty_code,
      specialtyName: row.specialty_name,
      createdAt: row.created_at,
    }));
  }

  /**
   * Lay 1 specialty theo id
   */
  async findById(id) {
    const result = await query(
      'SELECT id, specialty_code, specialty_name FROM specialties WHERE id = @p1',
      { p1: id }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: row.id,
      specialtyCode: row.specialty_code,
      specialtyName: row.specialty_name,
    };
  }

  /**
   * Kiem tra specialty_code da ton tai chua
   */
  async findByCode(code) {
    const result = await query(
      'SELECT id FROM specialties WHERE specialty_code = @p1',
      { p1: code }
    );
    return result.recordset[0] || null;
  }

  /**
   * Tao specialty moi
   */
  async create({ specialtyCode, specialtyName }) {
    const result = await query(
      `INSERT INTO specialties (specialty_code, specialty_name)
       OUTPUT INSERTED.id
       VALUES (@p1, @p2)`,
      { p1: specialtyCode, p2: specialtyName }
    );
    return result.recordset[0].id;
  }

  /**
   * Cap nhat specialty
   */
  async update(id, { specialtyName }) {
    await query(
      'UPDATE specialties SET specialty_name = @p2 WHERE id = @p1',
      { p1: id, p2: specialtyName }
    );
    return this.findById(id);
  }

  /**
   * Xoa specialty (chi xoa neu khong co user_specialty tham chieu)
   */
  async delete(id) {
    const check = await query(
      'SELECT COUNT(*) AS cnt FROM user_specialty WHERE specialty_id = @p1',
      { p1: id }
    );
    if (check.recordset[0].cnt > 0) {
      return { success: false, reason: 'has_users' };
    }
    await query('DELETE FROM specialties WHERE id = @p1', { p1: id });
    return { success: true };
  }

  /**
   * Lay tat ca specialties cua 1 user
   */
  async findByUserId(userId) {
    const result = await query(`
      SELECT s.id, s.specialty_code, s.specialty_name
      FROM specialties s
      JOIN user_specialty us ON us.specialty_id = s.id
      WHERE us.user_id = @p1
      ORDER BY s.specialty_code ASC
    `, { p1: userId });
    return result.recordset.map((row) => ({
      id: row.id,
      specialtyCode: row.specialty_code,
      specialtyName: row.specialty_name,
    }));
  }

  /**
   * Thay doi specialties cua 1 user (replace all)
   */
  async setUserSpecialties(userId, specialtyIds) {
    // Xoa tat ca specialties cu
    await query('DELETE FROM user_specialty WHERE user_id = @p1', { p1: userId });

    // Chen specialties moi
    if (specialtyIds && specialtyIds.length > 0) {
      const values = specialtyIds.map((sid, i) => `(@p1, @p${i + 2})`).join(', ');
      const params = { p1: userId };
      specialtyIds.forEach((sid, i) => { params[`p${i + 2}`] = Number(sid); });
      await query(
        `INSERT INTO user_specialty (user_id, specialty_id) VALUES ${values}`,
        params
      );
    }
  }
}

module.exports = SpecialtyRepository;
