import httpClient from './httpClient';

export async function searchVehiclesApi(term) {
  return httpClient.get(`/vehicles/search?q=${encodeURIComponent(term)}`); // mảng { customerId, fullName, ..., vehicleId, licensePlate, ... }
}

export async function getVehicleOwnerHistoryApi(vehicleId) {
  return httpClient.get(`/vehicles/${vehicleId}/owners`);
}

export async function transferVehicleOwnerApi(vehicleId, { newCustomerId, newCustomer, transferDate, notes } = {}) {
  return httpClient.post(`/vehicles/${vehicleId}/transfer`, { newCustomerId, newCustomer, transferDate, notes });
}
