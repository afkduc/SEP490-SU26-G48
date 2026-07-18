const { query } = require('../infrastructure/database/sqlServer');

const METHOD_TO_ACTION = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

const SKIP_PATHS = new Set(['/api/auth/login', '/api/auth/logout']);

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
  return segments[1].replace(/-/g, '_');
}

function inferRecordIdFromUrl(originalUrl) {
  const segments = parsePath(originalUrl);
  if (segments.length >= 3 && /^\d+$/.test(segments[2])) {
    return Number(segments[2]);
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

function buildDescription(action, entityName, entityCode, userName) {
  const parts = [action];
  if (entityName) parts.push(entityName);
  if (entityCode) parts.push(entityCode);
  parts.push('by');
  parts.push(userName || 'unknown');
  return parts.join(' ');
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

      // 1. Skip read-only requests — only audit write operations.
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

      // 2. Skip auth endpoints — those are recorded by loginSession middleware.
      const pathOnly = originalUrl.split('?')[0];
      if (SKIP_PATHS.has(pathOnly)) return;

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

      // 10. Build a human-readable description.
      const description = buildDescription(action, tableName, entityCode, userName);

      // 12. Fire-and-forget insert — never block the response cycle.
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
           @p13, @p14, @p15, @p16, @p17
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
          p15: user && user.branch_id ? user.branch_id : null,
          p16: description,
          p17: new Date(),
        }
      ).catch((e) => console.error('[auditLogger] failed to write audit log:', e.message));
    } catch (err) {
      console.error('[auditLogger] unexpected error:', err.message);
    }
  });

  next();
}

module.exports = auditLogger;