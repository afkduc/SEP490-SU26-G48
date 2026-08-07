import httpClient from './httpClient';

// occupy/release/heartbeat da bo han - khong con "1 thiet bi giu 1 khoang"
// nua (xem Landing/app/khoang cho man lam viec cong khai tai khoang, goi
// thang API public /public/bays/* thay vi qua httpClient).

// To truong (dang nhap chinh tai khoan cua ho) lay danh sach khoang minh
// phu trach - dung de chon khoang khi "Nhan viec" tren dashboard.
export async function listMyBaysApi() {
  return httpClient.get('/vehicle-bays/mine');
}

export async function listBranchBaysApi() {
  return httpClient.get('/vehicle-bays/branch-status');
}
