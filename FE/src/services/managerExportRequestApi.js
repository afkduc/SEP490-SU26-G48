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