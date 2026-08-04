import httpClient from './httpClient';

export async function listMyBaysApi() {
  return httpClient.get('/vehicle-bays/mine');
}

export async function listBranchBaysApi() {
  return httpClient.get('/vehicle-bays/branch-status');
}

export async function occupyBayApi(id, deviceId) {
  return httpClient.post(`/vehicle-bays/${id}/occupy`, { deviceId });
}

export async function releaseBayApi(id, deviceId) {
  return httpClient.post(`/vehicle-bays/${id}/release`, { deviceId });
}

export async function heartbeatBayApi(id, deviceId) {
  return httpClient.post(`/vehicle-bays/${id}/heartbeat`, { deviceId });
}
