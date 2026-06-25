import httpClient from './httpClient';

export async function loginApi(email, password) {
  const data = await httpClient.post('/auth/login', { email, password });
  return data.data; // { token, user }
}

export async function getMeApi() {
  const data = await httpClient.get('/auth/me');
  return data.data;
}
