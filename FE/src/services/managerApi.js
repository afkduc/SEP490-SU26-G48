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
}

const managerApi = new ManagerApi();

export default managerApi;
export { ManagerApi };
