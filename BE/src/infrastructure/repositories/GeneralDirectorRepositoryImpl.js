const GeneralDirectorRepository = require('../../domain/repositories/GeneralDirectorRepository');
const { query } = require('../database/sqlServer');

function normalizeDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function mapSettlementRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.order_code,
    serviceType: 'Bảo dưỡng/Sửa chữa',
    status: row.status,
    intakeDate: normalizeDate(row.intake_date),
    completedDate: normalizeDate(row.completed_date),
    total: Number(row.total || 0),
    subtotal: Number(row.subtotal || 0),
    discountAmount: Number(row.discount_amount || 0),
    afterDiscount: Number(row.after_discount || 0),
    vat: Number(row.vat || 0),
    freeAmount: Number(row.free_amount || 0),
    nextMaintenanceKm: row.next_maintenance_km,
    nextMaintenanceDate: row.next_maintenance_date ? normalizeDate(row.next_maintenance_date) : null,
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
      taxCode: row.customer_tax_code,
      cccd: row.customer_cccd,
      email: row.customer_email,
      contactPerson: row.customer_contact_name,
      contactPhone: row.customer_contact_phone,
    },
    vehicle: {
      id: row.vehicle_id,
      licensePlate: row.license_plate,
      vehicleModel: row.vehicle_model,
      manufactureYear: row.manufacture_year,
      frameNumber: row.frame_number,
      engineNumber: row.engine_number,
      currentKm: row.vehicle_current_km,
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

function monthLabel(value) {
  const date = normalizeDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${year}`;
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
    }
  });

  return Array.from(map.values());
}

function normalizeSkills(specialty) {
  if (!specialty) return [];
  const normalized = String(specialty)
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b, 'vi'));
}

function inferSkillGroups(specialty) {
  const text = (specialty || '').toLowerCase();
  const groups = [];

  if (/dong co|co khi|may|g(am|ầm)|phanh|treo/.test(text)) groups.push('mechanical');
  if (/dien|điện|dien tu|điện tử|cam bien|cảm biến/.test(text)) groups.push('electrical');
  if (/son|paint|dong son|đồng sơn|than vo|thân vỏ/.test(text)) groups.push('painting');
  if (/chan doan|chu[nẩ]n đo[aá]n|diagnostic|scan|obu|obd/.test(text)) groups.push('diagnostic');
  if (/bao duong|b[aả]o d[uư][oỡ]ng|dinh ky|định kỳ|oil|loc|lọc/.test(text)) groups.push('maintenance');

  if (groups.length === 0) groups.push('other');
  return Array.from(new Set(groups));
}

function skillGroupLabel(code) {
  const labels = {
    mechanical: 'Cơ khí',
    electrical: 'Điện - Điện tử',
    painting: 'Sơn - Đồng',
    diagnostic: 'Chuẩn đoán',
    maintenance: 'Bảo dưỡng',
    other: 'Khác',
  };
  return labels[code] || 'Khác';
}

function mapTechnician(row) {
  if (!row) return null;
  const skills = normalizeSkills(row.specialty);
  const skillGroups = inferSkillGroups(row.specialty);

  return {
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
    skills,
    skillGroups,
    skillGroupLabels: skillGroups.map(skillGroupLabel),
    activeAssignments: Number(row.active_assignments || 0),
    totalRepairs: Number(row.total_repairs || 0),
  };
}

class GeneralDirectorRepositoryImpl extends GeneralDirectorRepository {
  async getRevenueReports(filters = {}) {
    const branchId = filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null;
    const monthsBack = Number(filters.monthsBack) || 6;

    const summaryResult = await query(
      `DECLARE @month_start DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
       DECLARE @next_month_start DATE = DATEADD(MONTH, 1, @month_start);

       WITH current_orders AS (
         SELECT so.id, so.total
         FROM service_orders so
         WHERE so.status = 'invoiced'
           AND so.completed_date >= @month_start
           AND so.completed_date < @next_month_start
           AND (@branchId IS NULL OR so.branch_id = @branchId)
       )
       SELECT
         ISNULL((SELECT SUM(co.total) FROM current_orders co), 0) AS current_month_total_revenue,
         ISNULL((
           SELECT SUM(soi.total)
           FROM current_orders co
           INNER JOIN service_order_items soi ON soi.service_order_id = co.id
           WHERE soi.item_type = 'DV'
         ), 0) AS current_month_service_revenue,
         ISNULL((
           SELECT SUM(i.amount - i.paid)
           FROM invoices i
           WHERE i.status = 'unpaid'
             AND i.amount > i.paid
             AND (@branchId IS NULL OR i.branch_id = @branchId)
         ), 0) AS outstanding_receivables,
         @month_start AS current_month_start`,
      { branchId }
    );

    const trendResult = await query(
      `DECLARE @current_month_start DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

       WITH month_series AS (
         SELECT CAST(DATEADD(MONTH, -(@monthsBack - 1), @current_month_start) AS DATE) AS month_start
         UNION ALL
         SELECT DATEADD(MONTH, 1, month_start)
         FROM month_series
         WHERE month_start < @current_month_start
       ),
       monthly_orders AS (
         SELECT
           DATEFROMPARTS(YEAR(so.completed_date), MONTH(so.completed_date), 1) AS month_start,
           SUM(so.total) AS total_revenue
         FROM service_orders so
         WHERE so.status = 'invoiced'
           AND so.completed_date >= DATEADD(MONTH, -(@monthsBack - 1), @current_month_start)
           AND so.completed_date < DATEADD(MONTH, 1, @current_month_start)
           AND (@branchId IS NULL OR so.branch_id = @branchId)
         GROUP BY DATEFROMPARTS(YEAR(so.completed_date), MONTH(so.completed_date), 1)
       )
       SELECT
         ms.month_start,
         ISNULL(mo.total_revenue, 0) AS total_revenue
       FROM month_series ms
       LEFT JOIN monthly_orders mo ON mo.month_start = ms.month_start
       ORDER BY ms.month_start ASC
       OPTION (MAXRECURSION 100);`,
      { branchId, monthsBack }
    );

    const branchStatsResult = await query(
      `DECLARE @month_start DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
       DECLARE @next_month_start DATE = DATEADD(MONTH, 1, @month_start);

       WITH branch_scope AS (
         SELECT b.id, b.branch_code, b.branch_name
         FROM branches b
         WHERE b.is_active = 1
           AND (@branchId IS NULL OR b.id = @branchId)
       ),
       current_orders AS (
         SELECT so.id, so.branch_id, so.total
         FROM service_orders so
         WHERE so.status = 'invoiced'
           AND so.completed_date >= @month_start
           AND so.completed_date < @next_month_start
           AND (@branchId IS NULL OR so.branch_id = @branchId)
       ),
       branch_totals AS (
         SELECT
           bs.id,
           bs.branch_code,
           bs.branch_name,
           ISNULL(SUM(co.total), 0) AS total_revenue
         FROM branch_scope bs
         LEFT JOIN current_orders co ON co.branch_id = bs.id
         GROUP BY bs.id, bs.branch_code, bs.branch_name
       ),
       branch_service AS (
         SELECT
           co.branch_id,
           ISNULL(SUM(CASE WHEN soi.item_type = 'DV' THEN soi.total ELSE 0 END), 0) AS service_revenue
         FROM current_orders co
         LEFT JOIN service_order_items soi ON soi.service_order_id = co.id
         GROUP BY co.branch_id
       ),
       overall AS (
         SELECT ISNULL(SUM(bt.total_revenue), 0) AS grand_total
         FROM branch_totals bt
       )
       SELECT
         bt.id AS branch_id,
         bt.branch_code,
         bt.branch_name,
         ISNULL(bs.service_revenue, 0) AS service_revenue,
         bt.total_revenue,
         CASE
           WHEN o.grand_total = 0 THEN 0
           ELSE (bt.total_revenue * 100.0 / o.grand_total)
         END AS percentage
       FROM branch_totals bt
       LEFT JOIN branch_service bs ON bs.branch_id = bt.id
       CROSS JOIN overall o
       ORDER BY bt.total_revenue DESC, bt.branch_name ASC;`,
      { branchId }
    );

    const summaryRow = summaryResult.recordset[0] || {};

    return {
      summary: {
        currentMonthTotalRevenue: Number(summaryRow.current_month_total_revenue || 0),
        currentMonthServiceRevenue: Number(summaryRow.current_month_service_revenue || 0),
        outstandingReceivables: Number(summaryRow.outstanding_receivables || 0),
        currentMonthLabel: monthLabel(summaryRow.current_month_start),
      },
      monthlyTrend: trendResult.recordset.map((row) => {
        const monthStart = normalizeDate(row.month_start);
        const year = monthStart?.getFullYear() || null;
        const month = monthStart ? monthStart.getMonth() + 1 : null;
        return {
          month: year && month ? `${year}-${String(month).padStart(2, '0')}` : null,
          label: monthLabel(monthStart),
          totalRevenue: Number(row.total_revenue || 0),
        };
      }),
      branchStats: branchStatsResult.recordset.map((row) => ({
        branch: {
          id: row.branch_id,
          code: row.branch_code,
          name: row.branch_name,
        },
        serviceRevenue: Number(row.service_revenue || 0),
        totalRevenue: Number(row.total_revenue || 0),
        percentage: Number(row.percentage || 0),
      })),
      filters: {
        branchId: branchId || 'all',
        monthsBack,
      },
    };
  }

  async listSettlementReports(filters = {}) {
    const params = {
      search: filters.search ? `%${filters.search.trim()}%` : null,
      status: filters.status || null,
      branchId: filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null,
    };

    const where = ['1 = 1'];
    if (params.search) {
      where.push(`(
        so.order_code LIKE @search
        OR c.full_name LIKE @search
        OR c.phone LIKE @search
        OR v.license_plate LIKE @search
        OR ISNULL(v.vehicle_model_text, '') LIKE @search
        OR ISNULL(v.frame_number, '') LIKE @search
        OR ISNULL(v.engine_number, '') LIKE @search
        OR CAST(so.id AS VARCHAR(30)) LIKE @search
      )`);
    }
    if (params.status && params.status !== 'all') {
      where.push('so.status = @status');
    }
    if (params.branchId && params.branchId !== 'all') {
      where.push('so.branch_id = @branchId');
    }

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
          v.current_km AS vehicle_current_km,
          so.customer_id,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          c.tax_code AS customer_tax_code,
          c.cccd AS customer_cccd,
          c.email AS customer_email,
          c.contact_name AS customer_contact_name,
          c.contact_phone AS customer_contact_phone,
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
          so.next_maintenance_km,
          so.next_maintenance_date,
          so.intake_date,
          so.completed_date
       FROM service_orders so
       INNER JOIN branches b ON b.id = so.branch_id
       INNER JOIN customers c ON c.id = so.customer_id
       INNER JOIN vehicles v ON v.id = so.vehicle_id
       INNER JOIN users advisor ON advisor.id = so.advisor_id
       LEFT JOIN users leader ON leader.id = so.team_leader_id
       WHERE ${where.join(' AND ')}
       ORDER BY so.intake_date DESC, so.id DESC`,
      params
    );

    return result.recordset.map(mapSettlementRow);
  }

  async getSettlementReportById(id) {
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
          v.current_km AS vehicle_current_km,
          so.customer_id,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          c.tax_code AS customer_tax_code,
          c.cccd AS customer_cccd,
          c.email AS customer_email,
          c.contact_name AS customer_contact_name,
          c.contact_phone AS customer_contact_phone,
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
          so.next_maintenance_km,
          so.next_maintenance_date,
          so.intake_date,
          so.completed_date
       FROM service_orders so
       INNER JOIN branches b ON b.id = so.branch_id
       INNER JOIN customers c ON c.id = so.customer_id
       INNER JOIN vehicles v ON v.id = so.vehicle_id
       INNER JOIN users advisor ON advisor.id = so.advisor_id
       LEFT JOIN users leader ON leader.id = so.team_leader_id
       WHERE so.id = @id`,
      { id: Number(id) }
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

  async listBranches() {
    const result = await query(
      `SELECT id, branch_code, branch_name
       FROM branches
       WHERE is_active = 1
       ORDER BY branch_name ASC`
    );

    return result.recordset.map((row) => ({
      id: row.id,
      code: row.branch_code,
      name: row.branch_name,
    }));
  }

  async listEmployees(filters = {}) {
    const params = {
      search: filters.search ? `%${filters.search.trim()}%` : null,
      branchId: filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null,
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
          r.role_name,
          r.role_label
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE r.role_name IN ('manager', 'service_advisor', 'warehouse_staff', 'accountant', 'team_leader')
         AND (@branchId IS NULL OR u.branch_id = @branchId)
         AND (@status IS NULL OR u.status = @status)
         AND (@role IS NULL OR r.role_name = @role)
         AND (
           @search IS NULL
           OR u.pseudo_id LIKE @search
           OR u.user_name LIKE @search
           OR CAST(u.id AS VARCHAR(30)) LIKE @search
           OR ISNULL(u.phone, '') LIKE @search
           OR (ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')) LIKE @search
           OR (ISNULL(u.last_name, '') + ' ' + ISNULL(u.first_name, '')) LIKE @search
         )
       ORDER BY
         CASE WHEN u.status = 'active' THEN 0 ELSE 1 END,
         u.user_name ASC,
         u.id ASC`,
      params
    );

    return aggregateEmployees(result.recordset);
  }

  async getEmployeeById(id) {
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
          r.role_name,
          r.role_label
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = @id
         AND r.role_name IN ('manager', 'service_advisor', 'warehouse_staff', 'accountant', 'team_leader')
       ORDER BY
         CASE r.role_name
           WHEN 'manager' THEN 1
           WHEN 'service_advisor' THEN 2
           WHEN 'team_leader' THEN 3
           WHEN 'warehouse_staff' THEN 4
           WHEN 'accountant' THEN 5
           ELSE 99
         END`,
      { id: Number(id) }
    );

    const mapped = aggregateEmployees(result.recordset);
    if (mapped.length === 0) return null;
    return mapped[0];
  }

  async listTechnicians(filters = {}) {
    const params = {
      search: filters.search ? `%${filters.search.trim()}%` : null,
      branchId: filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null,
      status: filters.status && filters.status !== 'all' ? filters.status : null,
      skillGroup: filters.skillGroup && filters.skillGroup !== 'all' ? filters.skillGroup : null,
    };

    const skillCondition = {
      mechanical: "(LOWER(ISNULL(u.specialty, '')) LIKE N'%động cơ%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%co khi%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%cơ khí%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%gầm%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%phanh%')",
      electrical: "(LOWER(ISNULL(u.specialty, '')) LIKE N'%điện%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%dien%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%điện tử%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%cam bien%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%cảm biến%')",
      painting: "(LOWER(ISNULL(u.specialty, '')) LIKE N'%sơn%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%dong son%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%đồng sơn%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%than vo%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%thân vỏ%')",
      diagnostic: "(LOWER(ISNULL(u.specialty, '')) LIKE N'%chuẩn đoán%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%chuan doan%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%diagnostic%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%obd%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%scan%')",
      maintenance: "(LOWER(ISNULL(u.specialty, '')) LIKE N'%bảo dưỡng%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%bao duong%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%định kỳ%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%dinh ky%' OR LOWER(ISNULL(u.specialty, '')) LIKE N'%thay dầu%')",
      other: "(ISNULL(u.specialty, '') = '' OR (LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%động cơ%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%co khi%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%cơ khí%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%gầm%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%phanh%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%điện%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%dien%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%điện tử%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%cam bien%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%cảm biến%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%sơn%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%dong son%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%đồng sơn%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%than vo%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%thân vỏ%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%chuẩn đoán%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%chuan doan%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%diagnostic%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%obd%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%scan%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%bảo dưỡng%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%bao duong%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%định kỳ%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%dinh ky%' AND LOWER(ISNULL(u.specialty, '')) NOT LIKE N'%thay dầu%'))",
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
          ISNULL(stats.active_assignments, 0) AS active_assignments,
          ISNULL(stats.total_repairs, 0) AS total_repairs
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       INNER JOIN user_role ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       OUTER APPLY (
         SELECT
           SUM(CASE WHEN ro.status = 'inprogress' THEN 1 ELSE 0 END) AS active_assignments,
           COUNT(1) AS total_repairs
         FROM repair_orders ro
         WHERE ro.team_leader_id = u.id
       ) stats
       WHERE r.role_name = 'team_leader'
         AND (@branchId IS NULL OR u.branch_id = @branchId)
         AND (@status IS NULL OR u.status = @status)
         AND (
           @search IS NULL
           OR u.pseudo_id LIKE @search
           OR u.user_name LIKE @search
           OR CAST(u.id AS VARCHAR(30)) LIKE @search
           OR ISNULL(u.phone, '') LIKE @search
           OR ISNULL(u.specialty, '') LIKE @search
           OR (ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '')) LIKE @search
           OR (ISNULL(u.last_name, '') + ' ' + ISNULL(u.first_name, '')) LIKE @search
         )
         AND (
           @skillGroup IS NULL
           OR (
             @skillGroup = 'mechanical' AND ${skillCondition.mechanical}
           )
           OR (
             @skillGroup = 'electrical' AND ${skillCondition.electrical}
           )
           OR (
             @skillGroup = 'painting' AND ${skillCondition.painting}
           )
           OR (
             @skillGroup = 'diagnostic' AND ${skillCondition.diagnostic}
           )
           OR (
             @skillGroup = 'maintenance' AND ${skillCondition.maintenance}
           )
           OR (
             @skillGroup = 'other' AND ${skillCondition.other}
           )
         )
       ORDER BY
         CASE WHEN u.status = 'active' THEN 0 ELSE 1 END,
         u.user_name ASC,
         u.id ASC`,
      params
    );

    return result.recordset.map(mapTechnician);
  }

  async getTechnicianById(id) {
    const infoResult = await query(
      `SELECT TOP 1
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
          b.branch_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       INNER JOIN user_role ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE u.id = @id
         AND r.role_name = 'team_leader'`,
      { id: Number(id) }
    );

    const technician = mapTechnician(infoResult.recordset[0]);
    if (!technician) return null;

    const historyResult = await query(
      `SELECT TOP 20
          ro.id,
          ro.repair_code,
          ro.status,
          ro.created_at,
          ro.completed_at,
          ro.notes,
          so.order_code,
          so.total,
          so.completed_date,
          b.id AS branch_id,
          b.branch_code,
          b.branch_name,
          v.license_plate,
          v.vehicle_model_text AS vehicle_model,
          c.full_name AS customer_name
       FROM repair_orders ro
       LEFT JOIN service_orders so ON so.id = ro.service_order_id
       LEFT JOIN branches b ON b.id = ro.branch_id
       LEFT JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN customers c ON c.id = so.customer_id
       WHERE ro.team_leader_id = @id
       ORDER BY ro.created_at DESC, ro.id DESC`,
      { id: Number(id) }
    );

    technician.repairHistory = historyResult.recordset.map((row) => ({
      id: row.id,
      repairCode: row.repair_code,
      repairStatus: row.status,
      createdAt: normalizeDate(row.created_at),
      completedAt: normalizeDate(row.completed_at),
      notes: row.notes,
      orderCode: row.order_code,
      settlementTotal: Number(row.total || 0),
      settlementCompletedDate: normalizeDate(row.completed_date),
      branch: row.branch_id
        ? {
            id: row.branch_id,
            code: row.branch_code,
            name: row.branch_name,
          }
        : null,
      vehicle: {
        licensePlate: row.license_plate,
        model: row.vehicle_model,
      },
      customerName: row.customer_name,
    }));

    technician.repairSummary = {
      total: technician.repairHistory.length,
      completed: technician.repairHistory.filter((item) => item.repairStatus === 'completed').length,
      inprogress: technician.repairHistory.filter((item) => item.repairStatus === 'inprogress').length,
      cancelled: technician.repairHistory.filter((item) => item.repairStatus === 'cancelled').length,
      latestCompletedAt: technician.repairHistory
        .filter((item) => item.completedAt)
        .map((item) => item.completedAt)
        .sort((a, b) => b - a)[0] || null,
    };

    return technician;
  }
}

module.exports = GeneralDirectorRepositoryImpl;