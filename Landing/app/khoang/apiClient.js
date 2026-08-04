import { API_BASE_URL } from "../config";

// fetch() thuan (khong qua httpClient.js cua FE React, man nay khong dang
// nhap nen khong can token) - tu unwrap {success,message,data} va gan
// err.code tu payload (vd 'ORDER_CANCELLED') giong httpClient.js de cac noi
// goi co the "catch (err) { if (err.code === 'ORDER_CANCELLED') ... }".
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const err = new Error(body?.message || "Có lỗi xảy ra, vui lòng thử lại");
    err.code = body?.code || null;
    throw err;
  }
  return body.data;
}
