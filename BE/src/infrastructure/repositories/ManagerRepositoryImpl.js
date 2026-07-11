const { query } = require('../database/sqlServer');

const EMPLOYEE_ROLES = ['service_advisor', 'warehouse_staff', 'accountant'];

function normalizeDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function statusLabel(status) {
  return status === 'active' ? 'Đang làm' : 'Nghỉ';
}

function aggregateEmployees(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.id;
    if (!map.has(key)) {
      map.set(key, {
        id: row.id,
        employeeId: row.pseudo_id || String(row.id),
        fullName: row.user_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—',
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        statusLabel: statusLabel(row.status),
        specialty: row.specialty,
        teamSize: row.team_size,
        avatar: row.avatar,
        notes: row.notes,
        createdAt: normalizeDate(row.created_at),
        branch: row.branch_id
          ? {
              id: row.branch_id,
              code: row.branch_code,
              name: row.branch_name,
            }
          : null,
        roles: [],
        roleLabels: [],
        primaryRole: null,
        primaryRoleLabel: null,
        primaryRoleId: null,
      });
    }

    const employee = map.get(key);
    if (row.role_name && !employee.roles.includes(row.role_name)) {
      employee.roles.push(row.role_name);
    }
    if (row.role_label && !employee.roleLabels.includes(row.role_label)) {
      employee.roleLabels.push(row.role_label);
    }

    if (!employee.primaryRole && row.role_name) {
      employee.primaryRole = row.role_name;
      employee.primaryRoleLabel = row.role_label || row.role_name;
      employee.primaryRoleId = row.role_id;
    }
  });

  return Array.from(map.values());
}

class ManagerRepositoryImpl {
  async getBranchById(branchId) {
    const result = await query(
      `SELECT id, branch_code, branch_name FROM branches WHERE id = @branchId`,
      { branchId: Number(branchId) }
    );
    const row = result.recordset[0];
    if (!row) return null;
    return { id: row.id, code: row.branch_code, name: row.branch_name };
  }

  async listAssignableRoles() {
    const result = await query(
      `SELECT id, role_name, role_label FROM roles WHERE role_name IN ('${EMPLOYEE_ROLES.join("','")}') ORDER BY id ASC`
    );
    return result.recordset.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      roleLabel: row.role_label || row.role_name,
    }));
  }

  async listEmployees(branchId, filters = {}) {
    const params = {
      branchId: Number(branchId),
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status && filters.status !== 'all' ? filters.status : null,
      role: filters.role && filters.role !== 'all' ? filters.role : null,
    };

    const result = await query(
      `SELECT
          u.id,
          u.pseudo_id,
          u.user_name,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.status,
          u.specialty,
          u.team_size,
          u.avatar,
          u.notes,
          u.created_at,
          u.branch_id,
          b.branch_code,
          b.branch_name,
          r.id AS role_id,
          r.role_name,
          r.role_label
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.branch_id = @branchId
         AND r.role_name IN ('${EMPLOYEE_ROLES.join("','")}')
         AND (@status IS NULL OR u.status = @status)
         AND (@role IS NULL OR r.role_name = @role)
         AND (
           @search IS NULL
           OR u.pseudo_id LIKE @search
           OR u.user_name LIKE @search
           OR ISNULL(u.email, '') LIKE @search
           OR ISNULL(u.phone, '') LIKE @search
         )
       ORDER BY
         CASE WHEN u.status = 'active' THEN 0 ELSE 1 END,
         u.user_name ASC,
         u.id ASC`,
      params
    );

    return aggregateEmployees(result.recordset);
  }

  async getEmployeeById(branchId, id) {
    const result = await query(
      `SELECT
          u.id,
          u.pseudo_id,
          u.user_name,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.status,
          u.specialty,
          u.team_size,
          u.avatar,
          u.notes,
          u.created_at,
          u.branch_id,
          b.branch_code,
          b.branch_name,
          r.id AS role_id,
          r.role_name,
          r.role_label
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = @id
         AND u.branch_id = @branchId
         AND r.role_name IN ('${EMPLOYEE_ROLES.join("','")}')`,
      { id: Number(id), branchId: Number(branchId) }
    );

    const mapped = aggregateEmployees(result.recordset);
    if (mapped.length === 0) return null;
    return mapped[0];
  }

  async findByEmail(email) {
    const result = await query('SELECT TOP 1 id, email FROM users WHERE email = @email', { email });
    return result.recordset[0] || null;
  }

  async nextPseudoId() {
    const result = await query(
      `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(pseudo_id, 3, LEN(pseudo_id) - 2) AS INT)), 0) + 1 AS next_num
       FROM users
       WHERE pseudo_id LIKE 'NV%'`
    );
    const nextNum = result.recordset[0].next_num;
    return `NV${String(nextNum).padStart(3, '0')}`;
  }

  async createEmployee({ branchId, pseudoId, fullName, email, phone, passwordHash, roleId, status }) {
    const result = await query(
      `INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status, team_size, created_at)
       OUTPUT INSERTED.id
       VALUES (@pseudoId, @fullName, @email, @passwordHash, @fullName, '', @phone, @branchId, @status, 0, GETDATE())`,
      {
        pseudoId,
        fullName,
        email,
        passwordHash,
        phone: phone || null,
        branchId: Number(branchId),
        status,
      }
    );
    const userId = result.recordset[0].id;
    await query('INSERT INTO user_role (user_id, role_id) VALUES (@userId, @roleId)', {
      userId,
      roleId: Number(roleId),
    });
    return this.getEmployeeById(branchId, userId);
  }

  async updateEmployee(branchId, id, { fullName, email, phone, roleId, status }) {
    await query(
      `UPDATE users
       SET user_name = @fullName,
           first_name = @fullName,
           email = @email,
           phone = @phone,
           status = @status
       WHERE id = @id AND branch_id = @branchId`,
      {
        fullName,
        email,
        phone: phone || null,
        status,
        id: Number(id),
        branchId: Number(branchId),
      }
    );

    if (roleId) {
      await query('DELETE FROM user_role WHERE user_id = @id', { id: Number(id) });
      await query('INSERT INTO user_role (user_id, role_id) VALUES (@id, @roleId)', {
        id: Number(id),
        roleId: Number(roleId),
      });
    }

    return this.getEmployeeById(branchId, id);
  }
}

module.exports = ManagerRepositoryImpl;
