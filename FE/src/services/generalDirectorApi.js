import httpClient from './httpClient';

class GeneralDirectorApi {
  getSettlementReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/reports/settlements${query ? `?${query}` : ''}`);
  }

  getSettlementReportById(id) {
    return httpClient.get(`/general-director/reports/settlements/${id}`);
  }

  getBranches() {
    return httpClient.get('/general-director/branches');
  }

  getRevenueReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/reports/revenue${query ? `?${query}` : ''}`);
  }

  getEmployees(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/employees${query ? `?${query}` : ''}`);
  }

  getEmployeeById(id) {
    return httpClient.get(`/general-director/employees/${id}`);
  }

  getTechnicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/technicians${query ? `?${query}` : ''}`);
  }

  getTechnicianById(id) {
    return httpClient.get(`/general-director/technicians/${id}`);
  }

  getBranchManagers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/branch-managers${query ? `?${query}` : ''}`);
  }

  getBranchManagerById(id) {
    return httpClient.get(`/general-director/branch-managers/${id}`);
  }

  createBranchManager(payload) {
    return httpClient.post('/general-director/branch-managers', payload);
  }

  updateBranchManager(id, payload) {
    return httpClient.put(`/general-director/branch-managers/${id}`, payload);
  }

  deactivateBranch(id) {
    return httpClient.patch(`/general-director/branches/${id}/deactivate`);
  }

  reactivateBranch(id) {
    return httpClient.patch(`/general-director/branches/${id}/reactivate`);
  }
}

const generalDirectorApi = new GeneralDirectorApi();

export default generalDirectorApi;
export { GeneralDirectorApi };
