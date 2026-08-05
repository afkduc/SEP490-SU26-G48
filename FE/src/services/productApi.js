import httpClient from './httpClient';

/**
 * Product (Phu tung) API - module Kho.
 * Luu y: KHONG truyen stockQuantity len BE (BE se tu dong bo qua).
 *
 *   - list(params): GET /api/products voi filter { branchId, status, search, category, page, limit }.
 *     tra ve: { items: [{ id, productCode, productName, category, brandName, unitId, unitName, unitPrice,
 *                         stockQuantity, minStock, supplierId, supplierName, location, branchId, status, isLowStock }],
 *               total, page, limit }
 *
 *   - getDetail(id): GET /api/products/:id
 *
 *   - create(payload): POST /api/products  (payload KHONG bao gom stockQuantity)
 *   - update(id, payload): PUT /api/products/:id (payload KHONG bao gom stockQuantity)
 *   - remove(id): DELETE /api/products/:id
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

const STOCK_KEYS = ['stockQuantity', 'stock_quantity'];

function stripStock(payload) {
  const out = { ...payload };
  for (const k of STOCK_KEYS) delete out[k];
  return out;
}

export async function getProductsApi(params = {}) {
  return httpClient.get(`/products${buildQuery(params)}`);
}

export async function getProductByIdApi(id) {
  return httpClient.get(`/products/${id}`);
}

export async function createProductApi(payload) {
  return httpClient.post('/products', stripStock(payload));
}

export async function updateProductApi(id, payload) {
  return httpClient.put(`/products/${id}`, stripStock(payload));
}

/**
 * Soft-disable phụ tùng (status=inactive). Không hard delete.
 * BE: DELETE /api/products/:id → deactivate
 */
export async function deactivateProductApi(id) {
  return httpClient.delete(`/products/${id}`);
}

/** @deprecated Dùng deactivateProductApi — giữ alias để tương thích import cũ */
export async function deleteProductApi(id) {
  return deactivateProductApi(id);
}

export async function reactivateProductApi(id) {
  return httpClient.patch(`/products/${id}/reactivate`);
}

export async function getCategoriesApi() {
  return httpClient.get('/products/categories');
}

/**
 * Danh sách đơn vị tính (dùng cho dropdown chọn đơn vị của phụ tùng).
 * BE: GET /api/products/units -> [{ id, name }]
 */
export async function listUnitsApi() {
  return httpClient.get('/products/units');
}

/**
 * Tra cuu phu tung theo tu khoa (dung o trang quyet toan sua chua).
 * BE: GET /api/inventory/products/search?q=...
 */
export async function searchProductsApi(term, branchId) {
  const qs = new URLSearchParams();
  qs.set('q', term);
  if (branchId) qs.set('branchId', String(branchId));
  return httpClient.get(`/inventory/products/search?${qs.toString()}`);
}