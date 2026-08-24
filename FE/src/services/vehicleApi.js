import httpClient from './httpClient';

// Danh sach hang xe (Kia/Mazda - xem ghi chu trong
// ServiceRequestService.getPublicVehicleBrands) cho dropdown "Hãng xe" luc
// tao phieu quyet toan cho xe/khach hang moi (chua co trong DB). Tai su dung
// dung API public da co san cho form Lien he tren Landing, khong can tao API
// rieng cho CVDV.
export async function listVehicleBrandsApi() {
  return httpClient.get('/public/vehicle-brands');
}

// Catalog dong+doi xe that (vehicle_models) - dung lam goi y khi CVDV dang ky
// xe MOI, de moi xe deu gan duoc dung model_id (thay vi go tu do khong lien
// ket duoc voi catalog). Chi vai chuc dong, tai het 1 lan luc mo form, FE tu
// loc theo tu go - khong can API search rieng.
export async function listVehicleModelsApi() {
  return httpClient.get('/vehicles/models');
}

export async function searchVehiclesApi(term) {
  return httpClient.get(`/vehicles/search?q=${encodeURIComponent(term)}`); // mảng { customerId, fullName, ..., vehicleId, licensePlate, ... }
}

export async function getVehicleOwnerHistoryApi(vehicleId) {
  return httpClient.get(`/vehicles/${vehicleId}/owners`);
}

export async function transferVehicleOwnerApi(vehicleId, { newCustomerId, newCustomer, transferDate, notes } = {}) {
  return httpClient.post(`/vehicles/${vehicleId}/transfer`, { newCustomerId, newCustomer, transferDate, notes });
}
