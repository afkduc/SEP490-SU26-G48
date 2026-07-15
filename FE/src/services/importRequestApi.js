import httpClient from './httpClient';

/**
 * Import Request API (Phieu nhap kho) - module Kho.
 *
 * - getImportRequests(params): GET /api/import-requests voi filter branchId, status,
 *   supplierId, fromDate, toDate, search, page, limit.
 *   tra ve: { items: [{ id, requestCode, branchId, supplierId, supplierName,
 *                       supplierInvoiceNo, requestedBy, requestedByName,
 *                       approvedBy, approvedByName, importDate, status,
 *                       rejectReason, notes, createdAt, itemCount, totalQuantity,
 *                       items: [{...}] }], total, page, limit }
 *
 * - getImportRequestById(id): GET /api/import-requests/:id.
 *
 * - getNextImportRequestCode(params): GET /api/import-requests/meta/next-code.
 *
 * - createImportRequest(payload): POST /api/import-requests.
 *   payload: { branchId?, supplierId?, supplierInvoiceNo?, importDate?,
 *              notes?, items: [{ productId, productCode, productName, unit?, quantity }] }
 *
 * - approveImportRequest(id): PUT /api/import-requests/:id/approve.
 *
 * - rejectImportRequest(id, payload): PUT /api/import-requests/:id/reject.
 *   payload: { rejectReason }.
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

export async function getImportRequestsApi(params = {}) {
  return httpClient.get(`/import-requests${buildQuery(params)}`);
}

export async function getImportRequestByIdApi(id) {
  return httpClient.get(`/import-requests/${id}`);
}

export async function getNextImportRequestCodeApi(params = {}) {
  return httpClient.get(`/import-requests/meta/next-code${buildQuery(params)}`);
}

export async function createImportRequestApi(payload) {
  return httpClient.post('/import-requests', payload);
}

export async function approveImportRequestApi(id) {
  return httpClient.put(`/import-requests/${id}/approve`, {});
}

export async function rejectImportRequestApi(id, payload) {
  return httpClient.put(`/import-requests/${id}/reject`, payload);
}