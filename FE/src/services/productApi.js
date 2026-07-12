import httpClient from './httpClient';

export async function searchProductsApi(term) {
  return httpClient.get(`/inventory/products/search?q=${encodeURIComponent(term)}`); // [{ id, productCode, productName, unit, unitPrice, stockQuantity, ... }]
}
