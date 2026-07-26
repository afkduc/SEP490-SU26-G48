const { query } = require('../database/sqlServer');

// Tổ trưởng đã gộp vào module Nhân viên (dùng chung listEmployees/createEmployee/...),
// nên phải nằm trong EMPLOYEE_ROLES để hiện ra trong danh sách/tìm kiếm nhân viên.
const EMPLOYEE_ROLES = ['service_advisor', 'warehouse_staff', 'accountant', 'team_leader'];
// Vai trò được PHÉP GÁN khi tạo/sửa nhân viên (khác EMPLOYEE_ROLES ở chỗ không cho
// tạo mới Kế toán qua màn này nữa).
const ASSIGNABLE_EMPLOYEE_ROLES = ['service_advisor', 'warehouse_staff', 'team_leader'];
const TECHNICIAN_ROLE = 'technician';
const TEAM_LEADER_ROLE = 'team_leader';

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
        teamSize: row.team_size,
        teamMemberCount: row.team_member_count || 0,
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

function mapTechnicianRow(row) {
  return {
    id: row.id,
    employeeId: row.pseudo_id || String(row.id),
    fullName: row.user_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—',
    email: row.email,
    phone: row.phone,
    status: row.status,
    statusLabel: statusLabel(row.status),
    notes: row.notes,
    createdAt: normalizeDate(row.created_at),
    branch: row.branch_id
      ? { id: row.branch_id, code: row.branch_code, name: row.branch_name }
      : null,
    teamLeaderId: row.team_leader_id,
    teamLeaderName: row.team_leader_name || null,
    specialties: [],
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
    repairCategory: row.repair_category,
  };
}

function mapPackageRow(row) {
  return {
    id: row.id,
    code: row.package_code,
    name: row.package_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    totalPrice: Number(row.total_price || 0),
    description: row.description,
    purpose: row.purpose,
    isActive: !!row.is_active,
    repairCategory: row.repair_category,
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
      `SELECT id, role_name, role_label FROM roles WHERE role_name IN ('${ASSIGNABLE_EMPLOYEE_ROLES.join("','")}') ORDER BY id ASC`
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
          u.team_size,
          (SELECT COUNT(*) FROM users t WHERE t.team_leader_id = u.id) AS team_member_count,
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
          u.team_size,
          (SELECT COUNT(*) FROM users t WHERE t.team_leader_id = u.id) AS team_member_count,
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
    const employee = mapped[0];

    if (employee.roles.includes(TEAM_LEADER_ROLE)) {
      const membersResult = await query(
        `SELECT id, pseudo_id, user_name FROM users WHERE team_leader_id = @id ORDER BY user_name ASC`,
        { id: Number(id) }
      );
      employee.members = membersResult.recordset.map((r) => ({
        id: r.id,
        employeeId: r.pseudo_id,
        fullName: r.user_name,
      }));

      const specialtiesByUser = await this._fetchSpecialtiesByUserIds([Number(id)]);
      employee.specialties = specialtiesByUser.get(Number(id)) || [];
    }

    return employee;
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

  async createEmployee({ branchId, pseudoId, fullName, email, phone, passwordHash, roleId, status, specialtyIds }) {
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
    if (specialtyIds !== undefined) {
      await this._syncTechnicianSpecialties(userId, specialtyIds);
    }
    return this.getEmployeeById(branchId, userId);
  }

  async updateEmployee(branchId, id, { fullName, email, phone, roleId, status, specialtyIds }) {
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

    if (specialtyIds !== undefined) {
      await this._syncTechnicianSpecialties(id, specialtyIds);
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
              s.unit_price, s.duration_min, s.description, s.is_active, s.repair_category
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
              s.unit_price, s.duration_min, s.description, s.is_active, s.repair_category
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.id = @id AND s.branch_id = @branchId`,
      { id: Number(id), branchId: Number(branchId) }
    );
    const row = result.recordset[0];
    if (!row) return null;

    const parts = await this._listServiceParts(id);
    return { ...mapServiceRow(row), parts };
  }

  async _listServiceParts(serviceId) {
    const result = await query(
      `SELECT sp.product_id, p.product_code, p.product_name, u.unit_name, sp.quantity
       FROM service_parts sp
       JOIN products p ON p.id = sp.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE sp.service_id = @serviceId
       ORDER BY p.product_name ASC`,
      { serviceId: Number(serviceId) }
    );
    return result.recordset.map((r) => ({
      productId: r.product_id,
      productCode: r.product_code,
      productName: r.product_name,
      unitName: r.unit_name,
      quantity: r.quantity,
    }));
  }

  async _syncServiceParts(serviceId, parts = []) {
    await query('DELETE FROM service_parts WHERE service_id = @serviceId', { serviceId: Number(serviceId) });
    for (const part of parts) {
      await query('INSERT INTO service_parts (service_id, product_id, quantity) VALUES (@serviceId, @productId, @quantity)', {
        serviceId: Number(serviceId),
        productId: Number(part.productId),
        quantity: Number(part.quantity),
      });
    }
  }

  async listProducts(branchId) {
    const result = await query(
      `SELECT p.id, p.product_code, p.product_name, u.unit_name
       FROM products p
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE p.branch_id = @branchId AND p.status = 'active'
       ORDER BY p.product_name ASC`,
      { branchId: Number(branchId) }
    );
    return result.recordset.map((r) => ({
      id: r.id,
      code: r.product_code,
      name: r.product_name,
      unitName: r.unit_name,
    }));
  }

  async createService({ branchId, serviceCode, serviceName, categoryId, unitPrice, durationMin, description, repairCategory, parts }) {
    const result = await query(
      `INSERT INTO services (service_code, service_name, category_id, unit_price, duration_min, description, is_active, branch_id, repair_category)
       OUTPUT INSERTED.id
       VALUES (@serviceCode, @serviceName, @categoryId, @unitPrice, @durationMin, @description, 1, @branchId, @repairCategory)`,
      {
        serviceCode,
        serviceName,
        categoryId,
        unitPrice,
        durationMin,
        description,
        branchId: Number(branchId),
        repairCategory: repairCategory || null,
      }
    );
    const newId = result.recordset[0].id;
    await this._syncServiceParts(newId, parts);
    return this.getServiceById(branchId, newId);
  }

  async updateService(branchId, id, { serviceName, categoryId, unitPrice, durationMin, description, isActive, repairCategory, parts }) {
    await query(
      `UPDATE services
       SET service_name = @serviceName,
           category_id = @categoryId,
           unit_price = @unitPrice,
           duration_min = @durationMin,
           description = @description,
           is_active = @isActive,
           repair_category = @repairCategory
       WHERE id = @id AND branch_id = @branchId`,
      {
        serviceName,
        categoryId,
        unitPrice,
        durationMin,
        description,
        isActive: isActive ? 1 : 0,
        repairCategory: repairCategory || null,
        id: Number(id),
        branchId: Number(branchId),
      }
    );
    if (parts !== undefined) {
      await this._syncServiceParts(id, parts);
    }
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
              sp.total_price, sp.description, sp.purpose, sp.is_active, sp.repair_category,
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
              sp.total_price, sp.description, sp.purpose, sp.is_active, sp.repair_category
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

  async createServicePackage({ branchId, packageCode, packageName, categoryId, totalPrice, description, purpose, repairCategory, serviceIds }) {
    const result = await query(
      `INSERT INTO service_packages (package_code, package_name, category_id, total_price, description, purpose, is_active, branch_id, repair_category)
       OUTPUT INSERTED.id
       VALUES (@packageCode, @packageName, @categoryId, @totalPrice, @description, @purpose, 1, @branchId, @repairCategory)`,
      {
        packageCode,
        packageName,
        categoryId,
        totalPrice,
        description,
        purpose: purpose || null,
        branchId: Number(branchId),
        repairCategory: repairCategory || null,
      }
    );
    const packageId = result.recordset[0].id;
    await this._syncPackageItems(packageId, serviceIds);
    return this.getServicePackageById(branchId, packageId);
  }

  async updateServicePackage(branchId, id, { packageName, categoryId, totalPrice, description, purpose, isActive, repairCategory, serviceIds }) {
    await query(
      `UPDATE service_packages
       SET package_name = @packageName,
           category_id = @categoryId,
           total_price = @totalPrice,
           description = @description,
           purpose = @purpose,
           is_active = @isActive,
           repair_category = @repairCategory
       WHERE id = @id AND branch_id = @branchId`,
      {
        packageName,
        categoryId,
        totalPrice,
        description,
        purpose: purpose || null,
        isActive: isActive ? 1 : 0,
        repairCategory: repairCategory || null,
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

  async listSpecialties() {
    const result = await query('SELECT id, specialty_code, specialty_name FROM specialties ORDER BY specialty_name ASC');
    return result.recordset.map((row) => ({ id: row.id, code: row.specialty_code, name: row.specialty_name }));
  }

  async listTeamLeaderOptions(branchId) {
    const result = await query(
      `SELECT u.id, u.pseudo_id, u.user_name
       FROM users u
       WHERE u.branch_id = @branchId
         AND u.status = 'active'
         AND EXISTS (
           SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.role_name = '${TEAM_LEADER_ROLE}'
         )
       ORDER BY u.user_name ASC`,
      { branchId: Number(branchId) }
    );
    return result.recordset.map((row) => ({ id: row.id, employeeId: row.pseudo_id, fullName: row.user_name }));
  }

  async _fetchSpecialtiesByUserIds(userIds) {
    if (!userIds.length) return new Map();
    const inClause = userIds.map((_, i) => `@id${i}`).join(',');
    const params = {};
    userIds.forEach((id, i) => { params[`id${i}`] = Number(id); });

    const result = await query(
      `SELECT us.user_id, s.id, s.specialty_code, s.specialty_name
       FROM user_specialty us
       JOIN specialties s ON s.id = us.specialty_id
       WHERE us.user_id IN (${inClause})
       ORDER BY s.specialty_name ASC`,
      params
    );

    const map = new Map();
    result.recordset.forEach((row) => {
      if (!map.has(row.user_id)) map.set(row.user_id, []);
      map.get(row.user_id).push({ id: row.id, code: row.specialty_code, name: row.specialty_name });
    });
    return map;
  }

  async _syncTechnicianSpecialties(userId, specialtyIds = []) {
    await query('DELETE FROM user_specialty WHERE user_id = @userId', { userId: Number(userId) });
    for (const specialtyId of specialtyIds) {
      await query('INSERT INTO user_specialty (user_id, specialty_id) VALUES (@userId, @specialtyId)', {
        userId: Number(userId),
        specialtyId: Number(specialtyId),
      });
    }
  }

  async listTechnicians(branchId, filters = {}) {
    const params = {
      branchId: Number(branchId),
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status && filters.status !== 'all' ? filters.status : null,
      teamLeaderId: filters.teamLeaderId && filters.teamLeaderId !== 'all' ? Number(filters.teamLeaderId) : null,
    };

    const result = await query(
      `SELECT
          u.id, u.pseudo_id, u.user_name, u.first_name, u.last_name, u.email, u.phone,
          u.status, u.notes, u.created_at, u.branch_id, b.branch_code, b.branch_name,
          u.team_leader_id, tl.user_name AS team_leader_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN users tl ON tl.id = u.team_leader_id
       WHERE u.branch_id = @branchId
         AND EXISTS (
           SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.role_name = '${TECHNICIAN_ROLE}'
         )
         AND (@status IS NULL OR u.status = @status)
         AND (@teamLeaderId IS NULL OR u.team_leader_id = @teamLeaderId)
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

    const technicians = result.recordset.map(mapTechnicianRow);
    const specialtiesByUser = await this._fetchSpecialtiesByUserIds(technicians.map((t) => t.id));
    technicians.forEach((t) => { t.specialties = specialtiesByUser.get(t.id) || []; });
    return technicians;
  }

  async getTechnicianById(branchId, id) {
    const result = await query(
      `SELECT
          u.id, u.pseudo_id, u.user_name, u.first_name, u.last_name, u.email, u.phone,
          u.status, u.notes, u.created_at, u.branch_id, b.branch_code, b.branch_name,
          u.team_leader_id, tl.user_name AS team_leader_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN users tl ON tl.id = u.team_leader_id
       WHERE u.id = @id AND u.branch_id = @branchId
         AND EXISTS (
           SELECT 1 FROM user_role ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.role_name = '${TECHNICIAN_ROLE}'
         )`,
      { id: Number(id), branchId: Number(branchId) }
    );

    const row = result.recordset[0];
    if (!row) return null;

    const technician = mapTechnicianRow(row);
    const specialtiesByUser = await this._fetchSpecialtiesByUserIds([technician.id]);
    technician.specialties = specialtiesByUser.get(technician.id) || [];
    return technician;
  }

  async createTechnician({ branchId, pseudoId, fullName, email, phone, passwordHash, status, teamLeaderId, specialtyIds }) {
    const result = await query(
      `INSERT INTO users (pseudo_id, user_name, email, user_password, first_name, last_name, phone, branch_id, status, team_size, team_leader_id, created_at)
       OUTPUT INSERTED.id
       VALUES (@pseudoId, @fullName, @email, @passwordHash, @fullName, '', @phone, @branchId, @status, 0, @teamLeaderId, GETDATE())`,
      {
        pseudoId,
        fullName,
        email,
        passwordHash,
        phone: phone || null,
        branchId: Number(branchId),
        status,
        teamLeaderId: Number(teamLeaderId),
      }
    );
    const userId = result.recordset[0].id;
    await query(
      `INSERT INTO user_role (user_id, role_id) SELECT @userId, id FROM roles WHERE role_name = '${TECHNICIAN_ROLE}'`,
      { userId }
    );
    await this._syncTechnicianSpecialties(userId, specialtyIds);
    return this.getTechnicianById(branchId, userId);
  }

  async updateTechnician(branchId, id, { fullName, email, phone, status, teamLeaderId, specialtyIds }) {
    await query(
      `UPDATE users
       SET user_name = @fullName,
           first_name = @fullName,
           email = @email,
           phone = @phone,
           status = @status,
           team_leader_id = @teamLeaderId
       WHERE id = @id AND branch_id = @branchId`,
      {
        fullName,
        email,
        phone: phone || null,
        status,
        teamLeaderId: Number(teamLeaderId),
        id: Number(id),
        branchId: Number(branchId),
      }
    );

    if (specialtyIds !== undefined) {
      await this._syncTechnicianSpecialties(id, specialtyIds);
    }

    return this.getTechnicianById(branchId, id);
  }

}

module.exports = ManagerRepositoryImpl;
