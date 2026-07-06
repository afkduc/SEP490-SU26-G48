import httpClient from './httpClient';

export async function searchVehiclesApi(term) {
  const data = await httpClient.get(`/vehicles/search?q=${encodeURIComponent(term)}`);
  return data.data; // mảng { customerId, fullName, ..., vehicleId, licensePlate, ... }
}
