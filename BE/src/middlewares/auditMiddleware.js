const { query } = require('../infrastructure/database/sqlServer');

const METHOD_TO_ACTION = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// Paths that should NOT be audited at all.
// Auth flow is recorded by loginSessionMiddleware; audit endpoint
// itself shouldn't log its own reads or it would self-amplify.
const SKIP_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/audit',
  '/api/audit/',
]);

const SENSITIVE_FIELDS = [
  'password',
  'new_password',
  'old_password',
  'confirm_password',
  'token',
  'refresh_token',
  'access_token',
];

const ENTITY_CODE_FIELDS = [
  'order_code',
  'contract_code',
  'customer_code',
  'vehicle_code',
  'branch_code',
  'role_code',
  'service_code',
  'part_code',
  'invoice_code',
  'employee_code',
  'code',
];

const RECORD_ID_FIELDS = ['id', 'record_id', 'recordId'];

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field] !== undefined && sanitized[field] !== null) {
      sanitized[field] = '***';
    }
  }
  return sanitized;
}

function parsePath(url) {
  return url.split('?')[0].split('/').filter(Boolean);
}

function inferTableName(originalUrl) {
  const segments = parsePath(originalUrl);
  if (segments.length < 2 || segments[0] !== 'api') return null;
  // /api/admin/users/:id → users (khong lay "admin")
  if (segments[1] === 'admin' && segments[2]) {
    return String(segments[2]).replace(/-/g, '_');
  }
  return segments[1].replace(/-/g, '_');
}

function inferRecordIdFromUrl(originalUrl) {
  const segments = parsePath(originalUrl);
  // Tim segment so cuoi cung (vd /api/admin/users/1 → 1)
  for (let i = segments.length - 1; i >= 2; i -= 1) {
    if (/^\d+$/.test(segments[i])) return Number(segments[i]);
  }
  return null;
}

function toRecordIdNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function pickEntityCode(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const field of ENTITY_CODE_FIELDS) {
      if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
        return String(source[field]);
      }
    }
    if (source.data && typeof source.data === 'object') {
      for (const field of ENTITY_CODE_FIELDS) {
        if (source.data[field] !== undefined && source.data[field] !== null && source.data[field] !== '') {
          return String(source.data[field]);
        }
      }
    }
  }
  return null;
}

function pickResponseRecordId(responseBody) {
  if (!responseBody || typeof responseBody !== 'object') return null;
  for (const field of RECORD_ID_FIELDS) {
    const n = toRecordIdNumber(responseBody[field]);
    if (n !== null) return n;
  }
  if (responseBody.data && typeof responseBody.data === 'object') {
    for (const field of RECORD_ID_FIELDS) {
      const n = toRecordIdNumber(responseBody.data[field]);
      if (n !== null) return n;
    }
  }
  return null;
}

function buildDescription(action, entityName, entityCode, userName, when, userRoles) {
  // Sinh mô tả thân thiện với admin, ví dụ:
  //   "Lễ tân A tạo hợp đồng CT-001 lúc 14:35 19/07/2026"
  //   "Admin B cập nhật tài khoản USR-005 lúc 09:12 19/07/2026"
  //   "Anh C xóa khách hàng KH-009 lúc 16:02 19/07/2026"
  // Nguyên tắc: không log URL/endpoint, không log method, chỉ log:
  //   <tên gọi thân thiện của người dùng> <hành vi tiếng Việt>
  //   <tên đối tượng tiếng Việt> [mã] lúc <giờ phút> <ngày/tháng/năm>

  // Chọn nhãn vai trò theo thứ tự ưu tiên:
  //   1) nhãn tiếng Việt cho role đầu tiên trong mảng roles
  //   2) không có role → suy từ user_name
  //   3) fallback "Hệ thống" nếu thiếu hết
  const actor = pickActorLabel(userRoles, userName);

  const verb = ACTION_VERB[action] || 'tác động';
  const object = TABLE_LABEL[entityName] || entityName || 'dữ liệu';
  const code = entityCode ? ` ${entityCode}` : '';

  return `${actor} ${verb} ${object}${code} lúc ${formatVnDateTime(when || new Date())}`;
}

function pickActorLabel(roles, userName) {
  if (Array.isArray(roles)) {
    for (const r of roles) {
      const key = normalizeRole(r);
      if (ROLE_LABEL[key]) return ROLE_LABEL[key];
    }
  }
  return defaultActorLabel(userName);
}

// Map user_role → lời xưng thân thiện tiếng Việt.
// role được so khớp theo chuỗi con (case-insensitive).
const ROLE_LABEL = {
  admin: 'Admin',
  manager: 'Quản lý',
  receptionist: 'Lễ tân',
  sales: 'Nhân viên bán hàng',
  sale: 'Nhân viên bán hàng',
  technician: 'Kỹ thuật viên',
  warehouse_staff: 'Thủ kho',
  customer_care: 'Chăm sóc khách hàng',
  general_director: 'Giám đốc',
  director: 'Giám đốc',
  user: 'Người dùng',
};

function normalizeRole(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[^a-z_]/g, '');
}

// Khi không khớp vai trò, sinh nhãn mặc định dựa trên tên đăng nhập.
// Ví dụ: "nguyen.sale" → "Người dùng nguyen.sale".
function defaultActorLabel(userName) {
  if (!userName) return 'Hệ thống';
  // Nếu userName trông giống tên người (chứa dấu cách / viết hoa), dùng nguyên.
  if (/[A-Z][a-z]/.test(userName) || /\s/.test(userName)) return userName;
  return `Người dùng ${userName}`;
}

const ACTION_VERB = {
  CREATE: 'tạo',
  UPDATE: 'cập nhật',
  DELETE: 'xóa',
  LOGIN: 'đăng nhập',
  LOGOUT: 'đăng xuất',
  READ: 'xem',
};

// Map table_name → tên tiếng Việt dễ hiểu.
// Khớp theo key (lower-case, bỏ dấu gạch ngang) — thêm key mới khi có bảng mới.
const TABLE_LABEL = {
  users: 'tài khoản',
  user: 'tài khoản',
  customers: 'khách hàng',
  customer: 'khách hàng',
  vehicles: 'xe',
  vehicle: 'xe',
  orders: 'đơn hàng',
  order: 'đơn hàng',
  invoices: 'hóa đơn',
  invoice: 'hóa đơn',
  work_orders: 'phiếu sửa chữa',
  work_order: 'phiếu sửa chữa',
  repair_orders: 'phiếu sửa chữa',
  parts: 'phụ tùng',
  part: 'phụ tùng',
  suppliers: 'nhà cung cấp',
  supplier: 'nhà cung cấp',
  branches: 'chi nhánh',
  branch: 'chi nhánh',
  roles: 'vai trò',
  role: 'vai trò',
  specialties: 'chuyên môn',
  specialty: 'chuyên môn',
  services: 'dịch vụ',
  service: 'dịch vụ',
  import_requests: 'phiếu nhập kho',
  import_request: 'phiếu nhập kho',
  login_sessions: 'phiên đăng nhập',
  login_session: 'phiên đăng nhập',
  devices: 'thiết bị',
  device: 'thiết bị',
  notifications: 'thông báo',
  notification: 'thông báo',
  admin: 'tài khoản', // route /api/admin/... dùng 'admin' vì inferTableName lấy segment [1]
};

function formatVnDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function auditLogger(req, res, next) {
  const start = Date.now();

  // Intercept res.json so we can pull created record_id / entity_code from the response.
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body) {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    try {
      // Controller da goi auditHelper → khong ghi them ban trung
      if (req._manualAuditWritten) return;

      // Resolve IP cùng logic với loginSessionMiddleware (getRequestMeta).
      // Đảm bảo cả login_sessions và audit_logs ghi IP theo cùng 1 quy tắc
      // nên không có trường hợp 1 bảng có IP, bảng kia lại null.
      //   1) x-forwarded-for (proxy/CDN) — tách phần tử đầu tiên
      //   2) req.ip (Express + trust proxy)
      //   3) req.connection / req.socket .remoteAddress (IPv4/IPv6)
      //   4) x-real-ip (một số reverse-proxy dùng thay XFF)
      const xff = req.headers ? req.headers['x-forwarded-for'] : null;
      let ip = null;
      if (xff) ip = xff.split(',')[0].trim() || null;
      if (!ip) ip = req.ip || null;
      if (!ip && req.connection) ip = req.connection.remoteAddress || null;
      if (!ip && req.socket) ip = req.socket.remoteAddress || null;
      if (!ip) {
        const h = req.headers || {};
        ip = h['x-real-ip'] || null;
      }
      // Ip varchar(45) trong DB — truncate để chắc chắn không tràn.
      const ipFinal = ip ? String(ip).slice(0, 45) : null;

      const { method, originalUrl, body, user } = req;

      // 1. Only audit write operations. Read traffic is intentionally
      //    NOT logged — admins want to know what users *changed* (admin
      //    locked an account, receptionist created a contract, ...),
      //    not what they viewed. Reads would also explode the table
      //    given how chatty admin pages are.
      if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') return;

      // 2. Skip auth endpoints — those are recorded by loginSession middleware.
      const pathOnly = originalUrl.split('?')[0];
      if (SKIP_PATHS.has(pathOnly) || (pathOnly.startsWith('/api/audit'))) return;

      // 3. Map HTTP method → audit action.
      const action = METHOD_TO_ACTION[method];
      if (!action) return;

      // 4. Only audit routes under /api/*.
      const tableName = inferTableName(originalUrl);
      if (!tableName) return;

      // 5. Sanitize request body (strip passwords / tokens).
      const sanitizedBody = sanitizeBody(body);

      // 6. Resolve record_id — prefer URL path, fall back to response body.
      const responseBody = res.locals ? res.locals.responseBody : undefined;
      let recordId = inferRecordIdFromUrl(originalUrl);
      if (recordId == null) {
        recordId = pickResponseRecordId(responseBody);
      }

      // 7. Resolve entity_code — check request body first, then response body.
      const entityCode = pickEntityCode(body, responseBody);

      // 8. Resolve user info populated by authenticate middleware (BE/src/middlewares/auth.js).
      const userName = (user && (user.user_name || user.name || user.email)) || 'anonymous';
      const userId = user ? (user.id ?? user.userId ?? null) : null;
      const phoneNumber = user ? (user.phone ?? user.phone_number ?? null) : null;

      // 9. Capture final response status and elapsed time.
      const responseStatus = res.statusCode;
      const durationMs = Date.now() - start;

      // 10. Build a human-friendly description, e.g.
      //     "Lễ tân A tạo hợp đồng CT-001 lúc 14:35 19/07/2026".
      //     Designed so admins can read the timeline without seeing
      //     raw URLs, method names, or debug tokens.
      const userRoles = user && Array.isArray(user.roles) ? user.roles : [];
      const description = buildDescription(action, tableName, entityCode, userName, new Date(), userRoles);

      // 11. Fire-and-forget insert — never block the response cycle.
      const entityName = tableName; // use tableName as fallback entity name
      query(
        `INSERT INTO audit_logs (
           user_id, user_name, phone_number, action, table_name,
           entity_name, entity_code, record_id,
           ip_address, request_method, request_url, request_body,
           response_status, duration_ms, branch_id, description, logged_at
         )
         OUTPUT INSERTED.id
         VALUES (
           @p1, @p2, @p3, @p4, @p5,
           @p6, @p7, @p8,
           @p9, @p10, @p11, @p12,
           @p13, @p14, @p15, @p16, SYSUTCDATETIME()
         )`,
        {
          p1: userId,
          p2: String(userName).slice(0, 128),
          p3: phoneNumber,
          p4: action,
          p5: String(tableName).slice(0, 50),
          p6: entityName,
          p7: entityCode,
          p8: recordId,
          p9: ipFinal,
          p10: method,
          p11: String(originalUrl).slice(0, 500),
          p12: sanitizedBody ? JSON.stringify(sanitizedBody) : null,
          p13: responseStatus,
          p14: durationMs,
          p15: user && (user.branch_id ?? user.branchId) ? (user.branch_id ?? user.branchId) : null,
          p16: description,
        }
      ).catch((e) => console.error('[auditLogger] failed to write audit log:', e.message));
    } catch (err) {
      console.error('[auditLogger] unexpected error:', err.message);
    }
  });

  next();
}

module.exports = auditLogger;