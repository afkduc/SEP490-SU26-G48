import httpClient from './httpClient';

class ManagerApi {
  getBranch() {
    return httpClient.get('/manager/branch');
  }

  getRoles() {
    return httpClient.get('/manager/roles');
  }

  getEmployees(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/manager/employees${query ? `?${query}` : ''}`);
  }

  getEmployeeById(id) {
    return httpClient.get(`/manager/employees/${id}`);
  }

  createEmployee(payload) {
    return httpClient.post('/manager/employees', payload);
  }

  updateEmployee(id, payload) {
    return httpClient.put(`/manager/employees/${id}`, payload);
  }

  getServiceCategories() {
    return httpClient.get('/manager/service-categories');
  }

  getProducts() {
    return httpClient.get('/manager/products');
  }

  getServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/manager/services${query ? `?${query}` : ''}`);
  }

  getServiceById(id) {
    return httpClient.get(`/manager/services/${id}`);
  }

  createService(payload) {
    return httpClient.post('/manager/services', payload);
  }

  updateService(id, payload) {
    return httpClient.put(`/manager/services/${id}`, payload);
  }

  getServicePackages(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/manager/service-packages${query ? `?${query}` : ''}`);
  }

  getServicePackageById(id) {
    return httpClient.get(`/manager/service-packages/${id}`);
  }

  createServicePackage(payload) {
    return httpClient.post('/manager/service-packages', payload);
  }

  updateServicePackage(id, payload) {
    return httpClient.put(`/manager/service-packages/${id}`, payload);
  }

  getSettlementReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/manager/settlements${query ? `?${query}` : ''}`);
  }

  getSettlementReportById(id) {
    return httpClient.get(`/manager/settlements/${id}`);
  }

  getSpecialties() {
    return httpClient.get('/manager/specialties');
  }

  getTeamLeaderOptions() {
    return httpClient.get('/manager/team-leaders/options');
  }

  getTechnicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return httpClient.get(`/manager/technicians${query ? `?${query}` : ''}`);
  }

  getTechnicianById(id) {
    return httpClient.get(`/manager/technicians/${id}`);
  }

  createTechnician(payload) {
    return httpClient.post('/manager/technicians', payload);
  }

  updateTechnician(id, payload) {
    return httpClient.put(`/manager/technicians/${id}`, payload);
  }
}

const managerApi = new ManagerApi();

export default managerApi;
export { ManagerApi };
