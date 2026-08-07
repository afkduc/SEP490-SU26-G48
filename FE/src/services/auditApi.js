import httpClient from './httpClient';
import { API_BASE_URL } from '../config';
import { fetchBlob } from '../utils/downloadBlob';

/**
 * Build query string tu object, bo qua gia tri null/undefined/empty
 */
function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Audit Logs API
 *   - getAuditLogs(params): GET /api/audit
 *     params: {
 *       keyword, userName, phone, action, tableName, entityName,
 *       entityCode, ipAddress, requestMethod, responseStatus,
 *       startDate, endDate, branchId, page, pageSize
 *     }
 *     tra ve: {
 *       items: [...], total, page, pageSize,
 *       stats: { total, create, update, delete }
 *     }
 *
 *   - getAuditLogById(id): GET /api/audit/:id
 *     tra ve: { chi tiet mot audit log }
 *
 *   - getAuditLogsByUser(userId, limit): GET /api/audit/users/:userId/logs
 *     tra ve: [{...audit_log}]
 *
 *   - getLoginSessions(params): GET /api/audit/login-sessions
 *     params: { userName, phone, actionType, startDate, endDate, status, branchId, page, pageSize }
 *     tra ve: { items: [...], total, page, pageSize, stats: {...} }
 *
 *   - getEntityDefinitions(): GET /api/audit/entity-definitions
 *     tra ve: [{id, tableName, entityName, prefixCode, icon}]
 *
 *   - exportAuditLogs(params): GET /api/audit/export (Blob)
 *     tra ve: Blob (Excel file)
 */
class AuditApi {
  getAuditLogs(params = {}) {
    return httpClient.get(`/audit${buildQuery(params)}`);
  }

  getAuditLogById(id) {
    return httpClient.get(`/audit/${id}`);
  }

  getAuditLogsByUser(userId, limit) {
    return httpClient.get(`/audit/users/${userId}/logs${buildQuery({ limit })}`);
  }

  getLoginSessions(params = {}) {
    return httpClient.get(`/audit/login-sessions${buildQuery(params)}`);
  }

  getEntityDefinitions() {
    return httpClient.get('/audit/entity-definitions');
  }

  /**
   * Xuat audit logs ra file Excel (.xlsx) theo filter hien tai.
   * Tra ve Blob (tuong thich voi downloadBlob utility).
   */
  exportAuditLogs(params = {}) {
    const path = `${API_BASE_URL}/audit/export${buildQuery(params)}`;
    return fetchBlob(path);
  }

  exportLoginSessions(params = {}) {
    const path = `${API_BASE_URL}/audit/login-sessions/export${buildQuery(params)}`;
    return fetchBlob(path);
  }
}

const auditApi = new AuditApi();

export { AuditApi, auditApi };
