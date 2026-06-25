import httpClient from './httpClient';

class UserApi {
  getAll() {
    return httpClient.get('/users');
  }

  getById(id) {
    return httpClient.get(`/users/${id}`);
  }

  create(payload) {
    return httpClient.post('/users', payload);
  }

  update(id, payload) {
    return httpClient.put(`/users/${id}`, payload);
  }

  remove(id) {
    return httpClient.delete(`/users/${id}`);
  }
}

const userApi = new UserApi();

export default userApi;
export { UserApi };
