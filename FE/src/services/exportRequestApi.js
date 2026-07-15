import httpClient from './httpClient';

/**
 * Export Request API (Phieu xuat kho) - module Kho.
 *
 * Khac ImportRequest: NVKho xuat truc tiep theo Service Order, khong can Manager duyet.
 *
 * - getExportRequests(params): GET /api/export-requests voi filter branchId, status,
 *   serviceOrderId, fromDate, toDate, search, page, limit.
 * - getExportRequestById(id): GET /api/export-requests/:id.
 * - getNextExportRequestCode(params): GET /api/export-requests/meta/next-code.
 * - listExportableServiceOrders(params): GET /api/export-requests/service-orders/exportable.
 * - getServiceOrderForExport(id): GET /api/export-requests/service-orders/:id/for-export.
 * - createExportRequest(payload): POST /api/export-requests.
 *   payload: { branchId?, serviceOrderId, exportDate?, notes?,
 *              items: [{ productId, productCode, productName, unit?, quantity }] }
 */
function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.append(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function getExportRequestsApi(params = {}) {
  return httpClient.get(`/export-requests${buildQuery(params)}`);
}

export async function getExportRequestByIdApi(id) {
  return httpClient.get(`/export-requests/${id}`);
}

export async function getNextExportRequestCodeApi(params = {}) {
  return httpClient.get(`/export-requests/meta/next-code${buildQuery(params)}`);
}

export async function listExportableServiceOrdersApi(params = {}) {
  return httpClient.get(`/export-requests/service-orders/exportable${buildQuery(params)}`);
}

export async function getServiceOrderForExportApi(id) {
  return httpClient.get(`/export-requests/service-orders/${id}/for-export`);
}

export async function createExportRequestApi(payload) {
  return httpClient.post('/export-requests', payload);
}