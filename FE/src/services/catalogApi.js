import httpClient from './httpClient';

// modelId: đời xe của chiếc đang lập phiếu — BE lọc bỏ dịch vụ/gói của đời xe
// khác (loại dùng chung vẫn giữ). Lọc ở BE chứ không ở đây vì danh sách dịch
// vụ bị cắt còn 10 dòng: lọc phía FE thì 10 dòng lấy về có thể toàn của đời xe
// khác, đúng cái cần tìm thì đã bị cắt mất.
export async function searchCatalogApi(term, modelId) {
  const qs = new URLSearchParams({ q: term });
  if (modelId) qs.set('modelId', String(modelId));
  return httpClient.get(`/catalog/search?${qs.toString()}`); // { services: [{ id, code, name, categoryId, unitPrice, modelId }], packages: [{ id, code, name, totalPrice, modelId, items: [...] }] }
}
