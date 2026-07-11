import httpClient from './httpClient';

export async function searchCatalogApi(term) {
  const data = await httpClient.get(`/catalog/search?q=${encodeURIComponent(term)}`);
  return data.data; // { services: [{ id, code, name, categoryId, unitPrice }], packages: [{ id, code, name, applicableKm, totalPrice, items: [...] }] }
}
