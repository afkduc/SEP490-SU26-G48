import httpClient from './httpClient';

class GeneralDirectorApi {
  getSettlementReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/reports/settlements${query ? `?${query}` : ''}`);
  }

  getSettlementReportById(id) {
    return httpClient.get(`/general-director/reports/settlements/${id}`);
  }

  getRevenueReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/reports/revenue${query ? `?${query}` : ''}`);
  }

  getEmployees(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/employees${query ? `?${query}` : ''}`);
  }

  getTechnicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/general-director/technicians${query ? `?${query}` : ''}`);
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
}

const generalDirectorApi = new GeneralDirectorApi();

export default generalDirectorApi;
export { GeneralDirectorApi };
