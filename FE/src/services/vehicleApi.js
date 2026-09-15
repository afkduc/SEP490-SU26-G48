import httpClient from './httpClient';

// Catalog dong+doi xe that (vehicle_models) - dung lam goi y khi CVDV dang ky
// xe MOI, de moi xe deu gan duoc dung model_id (thay vi go tu do khong lien
// ket duoc voi catalog). Chi vai chuc dong, tai het 1 lan luc mo form, FE tu
// loc theo tu go - khong can API search rieng.
export async function listVehicleModelsApi() {
  return httpClient.get('/vehicles/models');
}

// 3 phan khuc dang co (Sedan/Hatchback, SUV/Crossover, Pickup Truck) - lam
// dropdown khi them dong xe moi.
export async function listVehicleSegmentsApi() {
  return httpClient.get('/vehicles/models/segments');
}

/**
 * Them dong xe moi vao danh muc (Manager). BE: POST /api/vehicles/models
 * payload: { modelLine, generationCode, trimName, segment, displayName }
 */
export async function createVehicleModelApi(data) {
  return httpClient.post('/vehicles/models', data);
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
