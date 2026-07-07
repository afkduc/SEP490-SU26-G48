/**
 * Part (Product) mock API – gia lap BE Products API.
 * Dung cho Ngay 4: CRUD phu tung / ton kho.
 *
 * Khi BE API san sang -> thay bang services/productApi.js (goi /api/products/*).
 */

import { mockParts, mockPartCategories, mockStockTransactions } from '../mocks/inventoryMockData';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (data) => JSON.parse(JSON.stringify(data));

const notFound = (msg) => {
  const err = new Error(msg);
  err.status = 404;
  return err;
};

const conflict = (msg) => {
  const err = new Error(msg);
  err.status = 409;
  return err;
};

let partStore = clone(mockParts);

// ===== Parts / Products =====

/**
 * Lay danh sach parts co loc theo search, status, category, lowStockOnly.
 * @param {Object} params - { search?, status?, category?, lowStockOnly? }
 * @returns {Promise<{ data: Part[], total: number }>}
 */
export async function getPartsApi(params = {}) {
  await delay();
  let result = clone(partStore);

  if (params.status) {
    result = result.filter((p) => p.status === params.status);
  }
  if (params.lowStockOnly) {
    result = result.filter((p) => p.stockQuantity < p.minStock);
  }
  if (params.category) {
    result = result.filter((p) => p.category === params.category);
  }
  if (params.search) {
    const kw = String(params.search).toLowerCase();
    result = result.filter(
      (p) =>
        p.partName.toLowerCase().includes(kw) ||
        p.partCode.toLowerCase().includes(kw),
    );
  }

  return { data: result, total: result.length };
}

/**
 * Lay chi tiet mot part theo id.
 * @param {number|string} id
 * @returns {Promise<{ data: Part }>}
 * @throws {Error} 404 neu khong tim thay
 */
export async function getPartByIdApi(id) {
  await delay();
  const found = partStore.find((p) => p.id === Number(id));
  if (!found) throw notFound(`Khong tim thay phu tung id=${id}`);
  return { data: clone(found) };
}

/**
 * Tao moi mot part. Kiem tra trung ma phu tung truoc khi tao.
 * @param {Object} payload - Dữ liệu part (partCode bat buoc)
 * @returns {Promise<{ data: Part }>}
 * @throws {Error} 409 neu ma phu tung da ton tai
 */
export async function createPartApi(payload) {
  await delay();
  const exists = partStore.find(
    (p) => p.partCode === payload.partCode,
  );
  if (exists) throw conflict(`Ma phu tung "${payload.partCode}" da ton tai`);
  const nextId = Math.max(...partStore.map((p) => p.id), 0) + 1;
  const created = {
    id: nextId,
    stockQuantity: 0,
    ...payload,
  };
  partStore.push(created);
  return { data: clone(created) };
}

/**
 * Cap nhat thong tin part theo id, ghi de cac truong duoc truyen.
 * @param {number|string} id
 * @param {Object} payload - Cac truong can cap nhat
 * @returns {Promise<{ data: Part }>}
 * @throws {Error} 404 neu khong tim thay
 */
export async function updatePartApi(id, payload) {
  await delay();
  const idx = partStore.findIndex((p) => p.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay phu tung id=${id}`);
  partStore[idx] = { ...partStore[idx], ...payload, id: Number(id) };
  return { data: clone(partStore[idx]) };
}

/**
 * Xoa mot part theo id khoi store.
 * @param {number|string} id
 * @returns {Promise<{ data: { id, deleted: boolean } }>}
 * @throws {Error} 404 neu khong tim thay
 */
export async function deletePartApi(id) {
  await delay();
  const idx = partStore.findIndex((p) => p.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay phu tung id=${id}`);
  partStore.splice(idx, 1);
  return { data: { id: Number(id), deleted: true } };
}

/**
 * Lay danh sach tat ca categories (danh mục phu tung).
 * @returns {Promise<{ data: Category[] }>}
 */
export async function getPartCategoriesApi() {
  await delay();
  return { data: clone(mockPartCategories) };
}

// ===== Stock / Dashboard =====

/**
 * Lay so lieu tong quan kho: tong so phu tung, gia tri ton kho, ton kho thap, het hang.
 * @returns {Promise<{ data: { totalParts, totalStockValue, lowStockCount, outOfStockCount } }>}
 */
export async function getStockSummaryApi() {
  await delay();
  const totalParts = partStore.length;
  const totalStockValue = partStore.reduce(
    (sum, p) => sum + p.stockQuantity * (p.unitPrice ?? 0),
    0,
  );
  const lowStockCount = partStore.filter(
    (p) => p.stockQuantity < p.minStock,
  ).length;
  const outOfStockCount = partStore.filter(
    (p) => p.stockQuantity === 0,
  ).length;
  return {
    data: { totalParts, totalStockValue, lowStockCount, outOfStockCount },
  };
}

/**
 * Lay lich su giao dich ton kho cua mot part (nhap/xuat/huy).
 * @param {number|string} partId
 * @returns {Promise<{ data: StockTransaction[] }>}
 */
export async function getStockHistoryApi(partId) {
  await delay();
  const result = mockStockTransactions.filter(
    (t) => t.partId === Number(partId),
  );
  return { data: clone(result) };
}
