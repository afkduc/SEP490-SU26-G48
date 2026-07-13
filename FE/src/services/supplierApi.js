import httpClient from './httpClient';

/**
 * Supplier API (read-only) - module Kho.
 *   - list(params): GET /api/suppliers voi filter search/status.
 *     tra ve: { items: [{ id, supplierCode, supplierName, contactName, phone, email, status }], total }
 *   - getDetail(id): GET /api/suppliers/:id (tra ve full info: ca address, taxCode).
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

export async function getSuppliersApi(params = {}) {
  return httpClient.get(`/suppliers${buildQuery(params)}`);
}

export async function getSupplierByIdApi(id) {
  return httpClient.get(`/suppliers/${id}`);
}