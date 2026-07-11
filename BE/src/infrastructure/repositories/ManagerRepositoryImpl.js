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

function mapSettlementRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.order_code,
    status: row.status,
    intakeDate: normalizeDate(row.intake_date),
    completedDate: normalizeDate(row.completed_date),
    total: Number(row.total || 0),
    subtotal: Number(row.subtotal || 0),
    discountAmount: Number(row.discount_amount || 0),
    afterDiscount: Number(row.after_discount || 0),
    vat: Number(row.vat || 0),
    freeAmount: Number(row.free_amount || 0),
    customerRequest: row.customer_request,
    currentKm: row.current_km,
    branch: {
      id: row.branch_id,
      code: row.branch_code,
      name: row.branch_name,
    },
    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address,
    },
    vehicle: {
      id: row.vehicle_id,
      licensePlate: row.license_plate,
      vehicleModel: row.vehicle_model,
      manufactureYear: row.manufacture_year,
      frameNumber: row.frame_number,
      engineNumber: row.engine_number,
    },
    advisor: {
      id: row.advisor_id,
      name: row.advisor_name,
      phone: row.advisor_phone,
    },
    teamLeader: row.team_leader_id
      ? {
          id: row.team_leader_id,
          name: row.team_leader_name,
          phone: row.team_leader_phone,
        }
      : null,
  };
}

function mapServiceRow(row) {
  return {
    id: row.id,
    code: row.service_code,
    name: row.service_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    unitPrice: Number(row.unit_price || 0),
    durationMin: row.duration_min,
    description: row.description,
    isActive: !!row.is_active,
  };
}

function mapPackageRow(row) {
  return {
    id: row.id,
    code: row.package_code,
    name: row.package_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    applicableKm: row.applicable_km,
    totalPrice: Number(row.total_price || 0),
    description: row.description,
    isActive: !!row.is_active,
  };
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

  async listServiceCategories() {
    const result = await query('SELECT id, category_name FROM service_categories ORDER BY category_name ASC');
    return result.recordset.map((row) => ({ id: row.id, name: row.category_name }));
  }

  async nextServiceCode(branchId) {
    const branch = await this.getBranchById(branchId);
    const prefix = `DV-${branch.code}-`;
    const result = await query(
      `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(service_code, @prefixLen, 10) AS INT)), 0) + 1 AS next_num
       FROM services WHERE service_code LIKE @likePattern`,
      { prefixLen: prefix.length + 1, likePattern: `${prefix}%` }
    );
    const nextNum = result.recordset[0].next_num;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async nextPackageCode(branchId) {
    const branch = await this.getBranchById(branchId);
    const prefix = `GOI-${branch.code}-`;
    const result = await query(
      `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(package_code, @prefixLen, 10) AS INT)), 0) + 1 AS next_num
       FROM service_packages WHERE package_code LIKE @likePattern`,
      { prefixLen: prefix.length + 1, likePattern: `${prefix}%` }
    );
    const nextNum = result.recordset[0].next_num;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async listServices(branchId, filters = {}) {
    const params = {
      branchId: Number(branchId),
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status && filters.status !== 'all' ? (filters.status === 'active' ? 1 : 0) : null,
      categoryId: filters.categoryId && filters.categoryId !== 'all' ? Number(filters.categoryId) : null,
    };

    const result = await query(
      `SELECT s.id, s.service_code, s.service_name, s.category_id, c.category_name,
              s.unit_price, s.duration_min, s.description, s.is_active
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.branch_id = @branchId
         AND (@status IS NULL OR s.is_active = @status)
         AND (@categoryId IS NULL OR s.category_id = @categoryId)
         AND (
           @search IS NULL
           OR s.service_code LIKE @search
           OR s.service_name LIKE @search
         )
       ORDER BY s.service_name ASC`,
      params
    );

    return result.recordset.map(mapServiceRow);
  }

  async getServiceById(branchId, id) {
    const result = await query(
      `SELECT s.id, s.service_code, s.service_name, s.category_id, c.category_name,
              s.unit_price, s.duration_min, s.description, s.is_active
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.id = @id AND s.branch_id = @branchId`,
      { id: Number(id), branchId: Number(branchId) }
    );
    const row = result.recordset[0];
    return row ? mapServiceRow(row) : null;
  }

  async createService({ branchId, serviceCode, serviceName, categoryId, unitPrice, durationMin, description }) {
    const result = await query(
      `INSERT INTO services (service_code, service_name, category_id, unit_price, duration_min, description, is_active, branch_id)
       OUTPUT INSERTED.id
       VALUES (@serviceCode, @serviceName, @categoryId, @unitPrice, @durationMin, @description, 1, @branchId)`,
      {
        serviceCode,
        serviceName,
        categoryId,
        unitPrice,
        durationMin,
        description,
        branchId: Number(branchId),
      }
    );
    return this.getServiceById(branchId, result.recordset[0].id);
  }

  async updateService(branchId, id, { serviceName, categoryId, unitPrice, durationMin, description, isActive }) {
    await query(
      `UPDATE services
       SET service_name = @serviceName,
           category_id = @categoryId,
           unit_price = @unitPrice,
           duration_min = @durationMin,
           description = @description,
           is_active = @isActive
       WHERE id = @id AND branch_id = @branchId`,
      {
        serviceName,
        categoryId,
        unitPrice,
        durationMin,
        description,
        isActive: isActive ? 1 : 0,
        id: Number(id),
        branchId: Number(branchId),
      }
    );
    return this.getServiceById(branchId, id);
  }

  async listServicePackages(branchId, filters = {}) {
    const params = {
      branchId: Number(branchId),
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status && filters.status !== 'all' ? (filters.status === 'active' ? 1 : 0) : null,
    };

    const result = await query(
      `SELECT sp.id, sp.package_code, sp.package_name, sp.category_id, c.category_name,
              sp.applicable_km, sp.total_price, sp.description, sp.is_active,
              (SELECT COUNT(*) FROM service_package_items spi WHERE spi.package_id = sp.id) AS item_count
       FROM service_packages sp
       LEFT JOIN service_categories c ON c.id = sp.category_id
       WHERE sp.branch_id = @branchId
         AND (@status IS NULL OR sp.is_active = @status)
         AND (
           @search IS NULL
           OR sp.package_code LIKE @search
           OR sp.package_name LIKE @search
         )
       ORDER BY sp.package_name ASC`,
      params
    );

    return result.recordset.map((row) => ({ ...mapPackageRow(row), itemCount: row.item_count }));
  }

  async getServicePackageById(branchId, id) {
    const result = await query(
      `SELECT sp.id, sp.package_code, sp.package_name, sp.category_id, c.category_name,
              sp.applicable_km, sp.total_price, sp.description, sp.is_active
       FROM service_packages sp
       LEFT JOIN service_categories c ON c.id = sp.category_id
       WHERE sp.id = @id AND sp.branch_id = @branchId`,
      { id: Number(id), branchId: Number(branchId) }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const itemsResult = await query(
      `SELECT s.id, s.service_code, s.service_name, s.unit_price, s.is_active
       FROM service_package_items spi
       JOIN services s ON s.id = spi.service_id
       WHERE spi.package_id = @id
       ORDER BY s.service_name ASC`,
      { id: Number(id) }
    );

    return {
      ...mapPackageRow(row),
      services: itemsResult.recordset.map((r) => ({
        id: r.id,
        code: r.service_code,
        name: r.service_name,
        unitPrice: Number(r.unit_price || 0),
        isActive: !!r.is_active,
      })),
    };
  }

  async listPackagesUsingService(branchId, serviceId) {
    const result = await query(
      `SELECT sp.id, sp.package_code, sp.package_name
       FROM service_package_items spi
       JOIN service_packages sp ON sp.id = spi.package_id
       WHERE spi.service_id = @serviceId AND sp.branch_id = @branchId AND sp.is_active = 1`,
      { serviceId: Number(serviceId), branchId: Number(branchId) }
    );
    return result.recordset.map((row) => ({ id: row.id, code: row.package_code, name: row.package_name }));
  }

  async _syncPackageItems(packageId, serviceIds = []) {
    await query('DELETE FROM service_package_items WHERE package_id = @packageId', { packageId: Number(packageId) });
    for (const serviceId of serviceIds) {
      await query('INSERT INTO service_package_items (package_id, service_id) VALUES (@packageId, @serviceId)', {
        packageId: Number(packageId),
        serviceId: Number(serviceId),
      });
    }
  }

  async createServicePackage({ branchId, packageCode, packageName, categoryId, applicableKm, totalPrice, description, serviceIds }) {
    const result = await query(
      `INSERT INTO service_packages (package_code, package_name, category_id, applicable_km, total_price, description, is_active, branch_id)
       OUTPUT INSERTED.id
       VALUES (@packageCode, @packageName, @categoryId, @applicableKm, @totalPrice, @description, 1, @branchId)`,
      {
        packageCode,
        packageName,
        categoryId,
        applicableKm,
        totalPrice,
        description,
        branchId: Number(branchId),
      }
    );
    const packageId = result.recordset[0].id;
    await this._syncPackageItems(packageId, serviceIds);
    return this.getServicePackageById(branchId, packageId);
  }

  async updateServicePackage(branchId, id, { packageName, categoryId, applicableKm, totalPrice, description, isActive, serviceIds }) {
    await query(
      `UPDATE service_packages
       SET package_name = @packageName,
           category_id = @categoryId,
           applicable_km = @applicableKm,
           total_price = @totalPrice,
           description = @description,
           is_active = @isActive
       WHERE id = @id AND branch_id = @branchId`,
      {
        packageName,
        categoryId,
        applicableKm,
        totalPrice,
        description,
        isActive: isActive ? 1 : 0,
        id: Number(id),
        branchId: Number(branchId),
      }
    );

    if (serviceIds) {
      await this._syncPackageItems(id, serviceIds);
    }

    return this.getServicePackageById(branchId, id);
  }

  async listSettlementReports(branchId, filters = {}) {
    const params = {
      branchId: Number(branchId),
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status && filters.status !== 'all' ? filters.status : null,
    };

    const result = await query(
      `SELECT
          so.id,
          so.order_code,
          so.branch_id,
          b.branch_code,
          b.branch_name,
          so.vehicle_id,
          v.license_plate,
          v.vehicle_model_text AS vehicle_model,
          v.manufacture_year,
          v.frame_number,
          v.engine_number,
          so.customer_id,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          so.advisor_id,
          advisor.user_name AS advisor_name,
          advisor.phone AS advisor_phone,
          so.team_leader_id,
          leader.user_name AS team_leader_name,
          leader.phone AS team_leader_phone,
          so.customer_request,
          so.current_km,
          so.status,
          so.subtotal,
          so.discount_amount,
          so.after_discount,
          so.vat,
          so.free_amount,
          so.total,
          so.intake_date,
          so.completed_date
       FROM service_orders so
       INNER JOIN branches b ON b.id = so.branch_id
       INNER JOIN customers c ON c.id = so.customer_id
       INNER JOIN vehicles v ON v.id = so.vehicle_id
       INNER JOIN users advisor ON advisor.id = so.advisor_id
       LEFT JOIN users leader ON leader.id = so.team_leader_id
       WHERE so.branch_id = @branchId
         AND (@status IS NULL OR so.status = @status)
         AND (
           @search IS NULL
           OR so.order_code LIKE @search
           OR c.full_name LIKE @search
           OR c.phone LIKE @search
           OR v.license_plate LIKE @search
         )
       ORDER BY so.intake_date DESC, so.id DESC`,
      params
    );

    return result.recordset.map(mapSettlementRow);
  }

  async getSettlementReportById(branchId, id) {
    const result = await query(
      `SELECT TOP 1
          so.id,
          so.order_code,
          so.branch_id,
          b.branch_code,
          b.branch_name,
          so.vehicle_id,
          v.license_plate,
          v.vehicle_model_text AS vehicle_model,
          v.manufacture_year,
          v.frame_number,
          v.engine_number,
          so.customer_id,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          so.advisor_id,
          advisor.user_name AS advisor_name,
          advisor.phone AS advisor_phone,
          so.team_leader_id,
          leader.user_name AS team_leader_name,
          leader.phone AS team_leader_phone,
          so.customer_request,
          so.current_km,
          so.status,
          so.subtotal,
          so.discount_amount,
          so.after_discount,
          so.vat,
          so.free_amount,
          so.total,
          so.intake_date,
          so.completed_date
       FROM service_orders so
       INNER JOIN branches b ON b.id = so.branch_id
       INNER JOIN customers c ON c.id = so.customer_id
       INNER JOIN vehicles v ON v.id = so.vehicle_id
       INNER JOIN users advisor ON advisor.id = so.advisor_id
       LEFT JOIN users leader ON leader.id = so.team_leader_id
       WHERE so.id = @id AND so.branch_id = @branchId`,
      { id: Number(id), branchId: Number(branchId) }
    );

    const order = mapSettlementRow(result.recordset[0]);
    if (!order) return null;

    const itemsResult = await query(
      `SELECT
          soi.id,
          soi.item_type,
          soi.product_id,
          soi.service_id,
          soi.item_code,
          soi.item_description,
          soi.lhsc,
          soi.httt,
          soi.unit,
          soi.quantity,
          soi.unit_price,
          soi.discount_pct,
          soi.is_free,
          soi.total
       FROM service_order_items soi
       WHERE soi.service_order_id = @id
       ORDER BY soi.id ASC`,
      { id: Number(id) }
    );

    order.items = itemsResult.recordset.map((row) => ({
      id: row.id,
      type: row.item_type,
      productId: row.product_id,
      serviceId: row.service_id,
      code: row.item_code,
      description: row.item_description,
      lhsc: row.lhsc,
      httt: row.httt,
      unit: row.unit,
      qty: row.quantity,
      unitPrice: Number(row.unit_price || 0),
      discount: Number(row.discount_pct || 0),
      isFree: Boolean(row.is_free),
      total: Number(row.total || 0),
    }));

    return order;
  }
}

module.exports = ManagerRepositoryImpl;
