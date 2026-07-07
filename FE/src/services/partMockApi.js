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

export async function getPartByIdApi(id) {
  await delay();
  const found = partStore.find((p) => p.id === Number(id));
  if (!found) throw notFound(`Khong tim thay phu tung id=${id}`);
  return { data: clone(found) };
}

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

export async function updatePartApi(id, payload) {
  await delay();
  const idx = partStore.findIndex((p) => p.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay phu tung id=${id}`);
  partStore[idx] = { ...partStore[idx], ...payload, id: Number(id) };
  return { data: clone(partStore[idx]) };
}

export async function deletePartApi(id) {
  await delay();
  const idx = partStore.findIndex((p) => p.id === Number(id));
  if (idx === -1) throw notFound(`Khong tim thay phu tung id=${id}`);
  partStore.splice(idx, 1);
  return { data: { id: Number(id), deleted: true } };
}

export async function getPartCategoriesApi() {
  await delay();
  return { data: clone(mockPartCategories) };
}

// ===== Stock / Dashboard =====

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

export async function getStockHistoryApi(partId) {
  await delay();
  const result = mockStockTransactions.filter(
    (t) => t.partId === Number(partId),
  );
  return { data: clone(result) };
}
