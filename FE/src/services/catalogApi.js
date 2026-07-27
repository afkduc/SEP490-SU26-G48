import httpClient from './httpClient';

export async function searchCatalogApi(term) {
  return httpClient.get(`/catalog/search?q=${encodeURIComponent(term)}`); // { services: [{ id, code, name, categoryId, unitPrice }], packages: [{ id, code, name, totalPrice, items: [...] }] }
}
