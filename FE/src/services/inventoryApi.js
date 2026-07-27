import httpClient from './httpClient';

/**
 * Inventory API (read-only) - module Kho.
 *   - getStockList(params): GET /api/inventory voi filter { branchId, search, category, lowStockOnly, page, limit }.
 *     tra ve: { items: [{ id, productCode, productName, category, brandName, unit, unitPrice,
 *                         stockQuantity, minStock, supplierId, supplierName, location, branchId, status,
 *                         isLowStock, stockGap }], total, page, limit }
 *
 *   - getLowStock(branchId): GET /api/inventory/low-stock?branchId=
 *     tra ve: { items: [...], total }
 *
 *   - getStockSummary(branchId): GET /api/inventory/summary?branchId=
 *     tra ve: { summary: [{ category, productCount, totalQuantity, totalValue }],
 *               totalProducts, totalQuantity, totalValue }
 *
 * Luu y: PATCH /:productId/adjust da duoc disable o BE, stock chi thay doi qua phieu nhap/xuat.
 */
function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'boolean') sp.append(k, v ? 'true' : 'false');
    else sp.append(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function getStockListApi(params = {}) {
  return httpClient.get(`/inventory${buildQuery(params)}`);
}

export async function getLowStockApi(branchId) {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return httpClient.get(`/inventory/low-stock${qs}`);
}

export async function getStockSummaryApi(branchId) {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return httpClient.get(`/inventory/summary${qs}`);
}

export async function getCategoriesApi() {
  return httpClient.get('/products/categories');
}