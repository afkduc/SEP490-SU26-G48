import httpClient from './httpClient';

// To truong (dang nhap binh thuong tu chinh tai khoan cua ho) nhan 1 phieu
// tu bang tin chung ca chi nhanh, gan cho 1 khoang cua minh - bayNumber
// truyen kem de BE echo lai dung so khoang trong event SSE 'claimed' cho
// cac khoang khac (bayId la id noi bo trong DB, khong phai so khoang hien thi).
export async function claimRepairOrderApi(repairOrderId, bayId, bayNumber) {
  return httpClient.post('/repair-orders/claim', { repairOrderId, bayId, bayNumber });
}

// Goi y tho (chi trong doi cua to truong dang dang nhap, ke ca dieu dong tu
// to khac) de gan ngay sau khi nhan viec.
export async function searchTechniciansApi(q) {
  return httpClient.get(`/repair-orders/technicians/search?q=${encodeURIComponent(q || '')}`);
}

// technicianIds: mang id - thay the toan bo danh sach tho thuc hien.
export async function setRepairOrderTechniciansApi(id, technicianIds) {
  return httpClient.patch(`/repair-orders/${id}/technicians`, { technicianIds });
}

// To truong xac nhan lenh da xong, SAU KHI khoang xe bam "Hoàn thành" (báo
// xong việc). Đây mới là bước làm phiếu quyết toán bên màn CVDV chuyển sang
// "Chờ thanh toán" và giải phóng khoang - xem BE RepairOrderService
// .reportBayCompleted / .confirmCompleted.
export async function confirmRepairOrderCompleteApi(id) {
  return httpClient.patch(`/repair-orders/${id}/confirm-complete`, {});
}

// To truong gỡ tích 1 đầu mục đã hoàn thành = yêu cầu làm lại đầu mục đó.
// Lệnh đang chờ xác nhận sẽ tự quay về "đang làm" cho khoang làm tiếp.
export async function reopenRepairOrderTaskApi(id, taskId) {
  return httpClient.patch(`/repair-orders/${id}/tasks/${taskId}/reopen`, {});
}

// Toan bo lenh sua chua cua to truong dang dang nhap (inprogress + hoan
// thanh) - dung cho tab "Khoang xe cua toi" (loc inprogress) va "Lich su"
// (loc completed) tren TeamLeaderDashboard.jsx.
export async function listMyRepairOrdersApi() {
  return httpClient.get('/repair-orders/mine');
}
