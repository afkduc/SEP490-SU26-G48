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
 *     params: { userName, phone, action, entityName, entityCode, startDate, endDate, branchId, page, pageSize }
 *     tra ve: { items: [{id, user_id, user_name, phone_number, action, table_name, entity_name, entity_code,
 *                        record_id, ip_address, request_method, request_url, request_body, response_status,
 *                        duration_ms, branch_id, description, logged_at}], total, page, pageSize }
 *
 *   - getAuditLogsByUser(userId, limit): GET /api/audit/users/:userId/logs
 *     tra ve: [{...audit_log}]
 *
 *   - getLoginSessions(params): GET /api/audit/login-sessions
 *     params: { userName, phone, actionType, startDate, endDate, status, branchId, page, pageSize }
 *     tra ve: { items: [{id, user_id, user_name, phone_number, action_type, ip_address, user_agent,
 *                        login_time, logout_time, session_duration_seconds, branch_id, status}], total, page, pageSize }
 *
 *   - getEntityDefinitions(): GET /api/audit/entity-definitions
 *     tra ve: [{id, tableName, entityName, prefixCode, icon}]
 */
class AuditApi {
  getAuditLogs(params = {}) {
    return httpClient.get(`/audit${buildQuery(params)}`);
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
   * BE se set Content-Disposition de lay ten file audit_logs_YYYYMMDD.xlsx.
   */
  exportAuditLogs(params = {}) {
    const path = `${API_BASE_URL}/audit/export${buildQuery(params)}`;
    return fetchBlob(path);
  }
}

const auditApi = new AuditApi();

export { AuditApi, auditApi };
