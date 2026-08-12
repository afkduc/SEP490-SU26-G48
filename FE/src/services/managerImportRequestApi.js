import httpClient from './httpClient';

/**
 * Manager Import Request API.
 * Manager truy cap /manager/import-requests ... de xem va duyet phieu
 * nhap kho cua chi nhanh minh quan ly.
 *
 * - list(params): GET /api/manager/import-requests?{branchId,status,...}
 * - getById(id):  GET /api/manager/import-requests/:id
 * - approve(id):  PUT /api/manager/import-requests/:id/approve
 * - reject(id, payload): PUT /api/manager/import-requests/:id/reject
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

export async function getManagerImportRequestsApi(params = {}) {
  return httpClient.get(`/manager/import-requests${buildQuery(params)}`);
}

export async function getManagerImportRequestByIdApi(id) {
  return httpClient.get(`/manager/import-requests/${id}`);
}

export async function approveManagerImportRequestApi(id) {
  return httpClient.put(`/manager/import-requests/${id}/approve`, {});
}

export async function rejectManagerImportRequestApi(id, payload) {
  return httpClient.put(`/manager/import-requests/${id}/reject`, payload);
}

/**
 * So phieu nhap chua duoc Manager xem (badge do tren Navbar).
 * BE: GET /api/manager/import-requests/new-count
 */
export async function getNewImportRequestsCountApi() {
  return httpClient.get('/manager/import-requests/new-count');
}

/**
 * Danh dau 1 phieu nhap la "da xem" (goi khi Manager mo trang chi tiet).
 * BE: PATCH /api/manager/import-requests/:id/mark-seen
 */
export async function markImportRequestSeenApi(id) {
  return httpClient.patch(`/manager/import-requests/${id}/mark-seen`);
}