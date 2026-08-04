import httpClient from './httpClient';

export async function listRepairOrdersApi() {
  return httpClient.get('/repair-orders'); // RepairOrder[]
}

export async function getRepairOrderApi(id) {
  return httpClient.get(`/repair-orders/${id}`);
}

// Tho tu nhan viec qua khoang xe (thay cho man "Phan cong" thu cong cu).
// Truyen kem bayNumber (khong chi bayId) de BE echo lai dung so khoang trong
// event SSE 'claimed' cho cac khoang khac hien dung "Khoang X da nhan" -
// bayId la id noi bo trong DB, khong phai so khoang hien thi.
export async function claimRepairOrderApi(serviceOrderId, bayId, bayNumber) {
  return httpClient.post('/repair-orders/claim', { serviceOrderId, bayId, bayNumber });
}

// Goi y tho may (chi trong doi cua to truong dang dang nhap) de gan vao lenh
// vua nhan - xem TechnicianPickerModal trong TeamLeaderKiosk.jsx.
export async function searchTechniciansApi(q) {
  return httpClient.get(`/repair-orders/technicians/search?q=${encodeURIComponent(q || '')}`);
}

// technicianIds: mang id - thay the toan bo danh sach tho thuc hien (co the
// nhieu tho cung sua 1 xe), khong phai them/bot tung nguoi.
export async function setRepairOrderTechniciansApi(id, technicianIds) {
  return httpClient.patch(`/repair-orders/${id}/technicians`, { technicianIds });
}

export async function updateRepairOrderStatusApi(id, status, reason) {
  return httpClient.patch(`/repair-orders/${id}/status`, { status, reason });
}

export async function updateRepairOrderTaskApi(id, taskId, isDone) {
  return httpClient.patch(`/repair-orders/${id}/tasks/${taskId}`, { isDone });
}
