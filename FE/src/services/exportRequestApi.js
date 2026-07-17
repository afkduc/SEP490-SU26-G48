import httpClient from './httpClient';

/**
 * Export Request API (Phieu xuat kho) - module Kho.
 * Xuất theo Repair Order (LSC-...), không theo Service Order (RO-...).
 *
 * - getExportRequests(params): GET /api/export-requests voi filter branchId, status,
 *   repairOrderId, fromDate, toDate, search, page, limit.
 * - getExportRequestById(id): GET /api/export-requests/:id.
 * - getNextExportRequestCode(params): GET /api/export-requests/meta/next-code.
 * - listExportableRepairOrders(params): GET /api/export-requests/repair-orders/exportable.
 * - getRepairOrderForExport(id): GET /api/export-requests/repair-orders/:id/for-export.
 * - createExportRequest(payload): POST /api/export-requests.
 *   payload: { branchId?, repairOrderId, exportDate?, notes?,
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

export async function listExportableRepairOrdersApi(params = {}) {
  return httpClient.get(`/export-requests/repair-orders/exportable${buildQuery(params)}`);
}

export async function getRepairOrderForExportApi(id) {
  return httpClient.get(`/export-requests/repair-orders/${id}/for-export`);
}

export async function createExportRequestApi(payload) {
  return httpClient.post('/export-requests', payload);
}