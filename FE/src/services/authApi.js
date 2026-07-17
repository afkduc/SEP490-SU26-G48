import httpClient from './httpClient';

export async function loginApi(email, password) {
  const data = await httpClient.post('/auth/login', { email, password });
  return data; // { token, user }
}

export async function logoutApi() {
  // PHIEN quan trong: phai goi de BE trackLogout cap nhat DB (status='ended',
  // logout_time, session_duration_seconds). Neu khong goi -> BE khong biet user
  // da dang xuat -> session vinh vien o trang thai 'active'.
  const data = await httpClient.post('/auth/logout', {});
  return data;
}

export async function getMeApi() {
  const data = await httpClient.get('/auth/me');
  return data;
}
