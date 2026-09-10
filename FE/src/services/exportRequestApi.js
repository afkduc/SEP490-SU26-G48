import httpClient from './httpClient';

/**
 * Export Request API (Phieu xuat kho) - module Kho.
 *
 * 1 Lenh sua chua = 1 phieu xuat duy nhat (ma phieu = ma RO), nhung duoc XUAT
 * THEM / TRA HANG nhieu lan cho den khi RO roi khoi waiting_repair/inprogress.
 *
 * - getExportRequests(params): GET /api/export-requests voi filter branchId, status,
 *   repairOrderId, fromDate, toDate, search, page, limit.
 * - getExportRequestById(id): GET /api/export-requests/:id.
 * - getExportPickups(id): GET /api/export-requests/:id/pickups - lich su tung lan
 *   lay/tra hang kem chu ky.
 * - listExportableRepairOrders(params): GET /api/export-requests/repair-orders/exportable.
 * - getRepairOrderForExport(id): GET /api/export-requests/repair-orders/:id/for-export.
 *   Tra ve { locked, items: [{ productId, requiredQuantity, exportedQuantity,
 *   pendingQuantity, currentStock, enoughStock }] } - pendingQuantity > 0 la con
 *   phai xuat, < 0 la phai tra lai kho.
 * - getExportTechnicians(params): GET /api/export-requests/technicians -> [{ id, employeeId, fullName }].
 * - createExportRequest(payload): POST /api/export-requests - xac nhan 1 lan lay hang.
 *   payload: { branchId?, repairOrderId, receivedBy, receivedSignatureData,
 *              productIds: [] }  (KHONG gui so luong - server tu tinh)
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

export async function getExportPickupsApi(id) {
  return httpClient.get(`/export-requests/${id}/pickups`);
}

export async function listExportableRepairOrdersApi(params = {}) {
  return httpClient.get(`/export-requests/repair-orders/exportable${buildQuery(params)}`);
}

export async function getRepairOrderForExportApi(id) {
  return httpClient.get(`/export-requests/repair-orders/${id}/for-export`);
}

export async function getExportTechniciansApi(params = {}) {
  return httpClient.get(`/export-requests/technicians${buildQuery(params)}`);
}

export async function createExportRequestApi(payload) {
  return httpClient.post('/export-requests', payload);
}