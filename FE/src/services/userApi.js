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

  /** Hard delete đã bỏ — dùng adminUsersApi.update({ status: 'inactive' }). */
  remove() {
    return Promise.reject(
      new Error('Hard delete user khong duoc ho tro. Su dung Disable/Ngung (cap nhat status).')
    );
  }
}

const userApi = new UserApi();

export default userApi;
export { UserApi };
