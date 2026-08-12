import httpClient from './httpClient';

/**
 * Manager Export Request API.
 * Manager chi xem lich su phieu xuat (read-only). NVKho tu xuat, khong can duyet.
 *
 * - list(params): GET /api/manager/export-requests?{branchId,status,...}
 * - getById(id):  GET /api/manager/export-requests/:id
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

export async function getManagerExportRequestsApi(params = {}) {
  return httpClient.get(`/manager/export-requests${buildQuery(params)}`);
}

export async function getManagerExportRequestByIdApi(id) {
  return httpClient.get(`/manager/export-requests/${id}`);
}

/**
 * So phieu xuat chua duoc Manager xem (badge do tren Navbar).
 * BE: GET /api/manager/export-requests/new-count
 */
export async function getNewExportRequestsCountApi() {
  return httpClient.get('/manager/export-requests/new-count');
}

/**
 * Danh dau 1 phieu xuat la "da xem" (goi khi Manager mo trang chi tiet).
 * BE: PATCH /api/manager/export-requests/:id/mark-seen
 */
export async function markExportRequestSeenApi(id) {
  return httpClient.patch(`/manager/export-requests/${id}/mark-seen`);
}