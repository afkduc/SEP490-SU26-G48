import httpClient from './httpClient';

export async function listCustomersApi({ search, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);
  return httpClient.get(`/customers?${params.toString()}`);
}

export async function getCustomerApi(id) {
  return httpClient.get(`/customers/${id}`);
}

export async function updateCustomerApi(id, data) {
  return httpClient.put(`/customers/${id}`, data);
}

export async function importCustomersApi(file) {
  const formData = new FormData();
  formData.append('file', file);
  return httpClient.postForm('/customers/import', formData);
}
